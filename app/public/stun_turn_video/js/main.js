/*********************************************************************************
  The MIT License (MIT) 

  Copyright (c) 2017 Xirsys

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in
  all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
  THE SOFTWARE.

*********************************************************************************/

'use strict';

// Getting references to page DOM for video calling.
var localVideoEl = document.getElementById('local-video'),
    remoteVideoEl = document.getElementById('remote-video'),
    callIdEl = document.getElementById('callID'),
    turnCB = document.getElementById('isTURNcb'),
    turnViewEL = document.getElementById('isTURN'),
    shareViewEl = document.getElementById('share-view'),
    shareTitleEl = document.getElementById('share-title');
    
var mediaConstraints = {
    audio: true,
    video: {
        "min":{"width":"800","height":"600"},
        "max":{"width":"1024","height":"768"}
    }
};

var localStream;//local audio and video stream
var remoteStream;//remote audio and video stream
var ice;//ice server query.
var sig;//sigaling
var peer;//peer connection.

/*if url has callid wait for other user in list with id to call
    else if no id in url create a sharable url with this username.*/
var username;//local username created dynamically.
var remoteCallID;//remote callid
var inCall = false;

//if there is no remoteCallID show sharable link to call user.

function callRemotePeer(){
    if (!!remoteCallID) {
        console.log('Calling ' + remoteCallID);
        peer.callPeer(remoteCallID);
    } else {
        console.log('Error', 'A remote peer was not found!');
    }
}

// Get Xirsys ICE (STUN/TURN)
function doICE(){
    console.log('doICE ');
    if(!ice){
        //var isTURN = getURLParameter("isTURN") == 'true';//get force turn var.
        //console.log('isTURN ',isTURN);
        ice = new $xirsys.ice('/webrtc')//,{turnOnly:isTURN});
        ice.on(ice.onICEList, onICE);
    }
}
function onICE(evt){
    console.log('onICE ',evt);
    if(evt.type == ice.onICEList){
        getMyMedia();
    }
}

//Get local user media
function getMyMedia(){
    console.log('getMyMedia()');
    navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then(str => {setLocalStream(str); doSignal();})//onSuccess
    .catch(err => { console.log('Could not get Media: ', err); alert('Could not get Media!! Please check your camera and mic.'); });
}

//Get Xirsys Signaling service
function doSignal(){
    sig = new $xirsys.signal( '/webrtc', username );
    sig.on('message', msg => {
        var pkt = JSON.parse(msg.data);
        //console.log('*index*  signal message! ',pkt);
        var payload = pkt.p;//the actual message data sent 
        var meta = pkt.m;//meta object
        var msgEvent = meta.o;//event label of message
        var toPeer = meta.t;//msg to user (if private msg)
        var fromPeer = meta.f;//msg from user
        //remove the peer path to display just the name not path.
        if(!!fromPeer) {
            var p = fromPeer.split("/");
            fromPeer = p[p.length - 1];
        }
        switch (msgEvent) {
            //first Connect Success!, list of all peers connected.
            case "peers":
                //this is first call when you connect, 
                onReady();
                // if we are connecting to a remote user and remote 
                // user id is found in the list then initiate call
                if(!!remoteCallID) {
                    var users = payload.users;
                    var l = users.length;
                    for (var i = 0; i < l; i++) {
                        var user = users[i];
                        //if this is the user, call them.
                        if (user === remoteCallID) {
                            callRemotePeer();
                        }
                    }
                }
                break;
            //peer gone.
            case "peer_removed":
                if(fromPeer == remoteCallID) onStopCall();
                break;
            
            // new peer connected
            //case "peer_connected":
            // 	addUser(fromPeer);
            // 	break;
            // message received. Call to display.
            //case 'message':
            // 	onUserMsg(payload.msg, fromPeer, toPeer);
            // 	break;
        }
    })
}

//Ready - We have our ICE servers, our Media and our Signaling.
function onReady(){
    console.log('* onReady!');
    // setup peer connector, pass signal, our media and iceServers list.
    let isTURN = getURLParameter("isTURN") == 'true';//get force turn var.
    console.log('isTURN ',isTURN);
    peer = new $xirsys.p2p(sig,localStream,(!ice ? {} : {iceServers:ice.iceServers}), {forceTurn:isTURN});
    //add listener when a call is started.
    peer.on(peer.peerConnSuccess, onStartCall);
}
// A peer call started udpate the UI to show remote video.
function onStartCall(evt){
    console.log('*index*  onStartCall ',evt);
    var remoteId = evt.data;
    setRemoteStream(peer.getLiveStream(remoteId));
    if(localVideoEl.classList.contains('major-box')){
        localVideoEl.classList.remove('major-box');
        localVideoEl.classList.add('minor-box');
    }
    if(remoteVideoEl.classList.contains('hidden')){
        remoteVideoEl.classList.remove('hidden');
    }
    shareTitleEl.innerHTML = 'In call with user:';
    remoteCallID = remoteId;
    inCall = true;
}

function onStopCall() {
    console.log('*index*  onStopCall ');
    if( inCall ){
        peer.hangup(remoteCallID);
    }
    if(localVideoEl.classList.contains('minor-box')){
        localVideoEl.classList.remove('minor-box');
        localVideoEl.classList.add('major-box');
    }
    if(!remoteVideoEl.classList.contains('hidden')){
        remoteVideoEl.classList.add('hidden');
    }
    inCall = false;
    remoteCallID = null;
}

/* UI METHODS */

//sets local user media to video object.
function setLocalStream(str){
    console.log('setLocal Video ',str);
    localStream = str;
    localVideoEl.srcObject = localStream;
}
//sets remote user media to video object.
function setRemoteStream(str){
    console.log('setRemote Video ',str);
    remoteStream = str;
    remoteVideoEl.srcObject = remoteStream;
}


/* TOOLS */

//gets URL parameters
function getURLParameter(name) {
    var ret = decodeURI( (RegExp(name + '=' + '(.+?)(&|$)').exec(location.search)||[,null])[1] ) 
    return  ret == 'null' ? null : ret;
};
//makes unique userid
function guid(s='user') {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return s + s4() + s4();
}

window.onload = () => {
    console.log('pretty loaded!!');
    username = guid();//create random local username
    var urlName = getURLParameter("callid");//get call id if exists from url
    if(!!urlName) {
        remoteCallID = urlName;
        shareTitleEl.innerHTML = 'Calling User...';
        callIdEl.value = remoteCallID;
        console.log('turnview: ',turnViewEL);
        turnViewEL.style.display = 'none';
    } // if call id does not exist this is the callee
    else {
        //callIdEl.innerHTML = location.origin + location.pathname + '?callid='+username;
        callIdEl.value = location.origin + location.pathname + '?callid='+username;

        $(turnCB).on('click', evt => {
            //console.log('TURN: ',evt);
            let checked = evt.target.checked;
            if(checked == true){
                callIdEl.value = location.origin + location.pathname + '?callid='+username+'&isTURN=true';
            } else {
                callIdEl.value = location.origin + location.pathname + '?callid='+username;
            }
            peer.forceTurn = checked;
        })
    }
    //get Xirsys service
    doICE();
};
