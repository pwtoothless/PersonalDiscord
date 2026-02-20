let localAudioStream = null;
const peerConnections = {}; 
let socket = null;

function javaLikeHashCode(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);
        hash = Math.imul(31, hash) + charCode;
        hash |= 0; 
    }
    return hash;
}

document.getElementById('login-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const data = {
        username: javaLikeHashCode(username),
        password: javaLikeHashCode(password)
    };

    fetch('http://mayflowerparadise.cloud-ip.cc:8082/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            document.querySelector('.login-container').style.display = 'none';
            document.getElementById('app-wrapper').style.display = 'flex';
            establishWebSocket(username); 
        } else {
            alert('Login failed: ' + data.message);
        }
    })
    .catch(error => console.error('Error:', error));
});

function joinVoiceChannel(channelName) {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
            localAudioStream = stream;
            socket.send(JSON.stringify({ type: 'join-voice', channel: channelName }));
        })
        .catch(err => alert("Microphone access denied."));
}

function createPeerConnection(targetUser) {
    const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    const peer = new RTCPeerConnection(rtcConfig);

    if (localAudioStream) {
        localAudioStream.getTracks().forEach(track => peer.addTrack(track, localAudioStream));
    }

    peer.onicecandidate = (event) => {
        if (event.candidate) {
            socket.send(JSON.stringify({ type: 'webrtc-ice', target: targetUser, candidate: event.candidate }));
        }
    };

    peer.ontrack = (event) => {
        let audioEl = document.getElementById('audio-' + targetUser);
        if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.id = 'audio-' + targetUser;
            audioEl.autoplay = true;
            document.body.appendChild(audioEl);
        }
        audioEl.srcObject = event.streams[0];
    };

    peerConnections[targetUser] = peer;
    return peer;
}

function establishWebSocket(username) {
    socket = new WebSocket('ws://mayflowerparadise.cloud-ip.cc:8081');
    const chatInput = document.getElementById('chat-input');
    const chatHistory = document.getElementById('chat-history');
    const userList = document.getElementById('user-list');

    socket.onopen = () => socket.send(JSON.stringify({ type: 'join', username: username }));

    chatInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' && chatInput.value.trim() !== '') {
            socket.send(JSON.stringify({ type: 'chat', message: chatInput.value }));
            chatInput.value = ''; 
        }
    });

    socket.onmessage = async function(event) {
        try {
            const data = JSON.parse(event.data);

            if (data.type === 'users') {
                userList.innerHTML = '';
                data.list.forEach(user => {
                    const li = document.createElement('li');
                    li.textContent = user;
                    userList.appendChild(li);
                });
            } else if (data.type === 'chat') {
                const msgDiv = document.createElement('div');
                msgDiv.className = 'chat-message';
                msgDiv.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
                chatHistory.appendChild(msgDiv);
                chatHistory.scrollTop = chatHistory.scrollHeight; 
            } else if (data.type === 'voice-users') {
                document.querySelectorAll('.channel-users').forEach(el => el.innerHTML = '');
                for (const [channel, users] of Object.entries(data.channels)) {
                    const userDiv = document.getElementById('voice-users-' + channel);
                    if (userDiv && users.length > 0) userDiv.textContent = users.join(', ');
                }
            } else if (data.type === 'user-joined-voice') {
                const peer = createPeerConnection(data.username);
                const offer = await peer.createOffer();
                await peer.setLocalDescription(offer);
                socket.send(JSON.stringify({ type: 'webrtc-offer', target: data.username, offer: offer }));
            } else if (data.type === 'webrtc-offer') {
                const peer = createPeerConnection(data.sender);
                await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                socket.send(JSON.stringify({ type: 'webrtc-answer', target: data.sender, answer: answer }));
            } else if (data.type === 'webrtc-answer') {
                const peer = peerConnections[data.sender];
                await peer.setRemoteDescription(new RTCSessionDescription(data.answer));
            } else if (data.type === 'webrtc-ice') {
                const peer = peerConnections[data.sender];
                if (peer) await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
        } catch (e) { console.error("Error processing message: ", e); }
    };
}