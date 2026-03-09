let localStream = null;
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

    // Updated to use the secure HTTPS domain
    fetch('https://betterchat.cloudns.ch:8082/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            try {
                document.getElementById('login-sound').play();
            } catch (e) {
                console.error("Could not play login sound:", e);
            }
            const loginContainer = document.querySelector('.login-container');
            const appWrapper = document.getElementById('app-wrapper');

            loginContainer.classList.add('fade-out');

            setTimeout(() => {
                loginContainer.style.display = 'none';
                appWrapper.style.display = 'flex';
                // We need to wait for the display property to be applied before adding the class
                setTimeout(() => {
                    appWrapper.classList.add('fade-in');
                    establishWebSocket(username);
                }, 10);
            }, 500); // Match the CSS transition duration
        } else {
            alert('Login failed: ' + data.message);
        }
    })
    .catch(error => console.error('Error:', error));
});

// --- WebRTC Media Controls ---

async function addStreamToPeers(newStream) {
    document.getElementById('video-modal').style.display = 'flex';
    
    const videoTrack = newStream.getVideoTracks()[0];
    if (!videoTrack) return;

    // Show local video
    let localVideo = document.getElementById('local-video');
    if (!localVideo) {
        localVideo = document.createElement('video');
        localVideo.id = 'local-video';
        localVideo.autoplay = true;
        localVideo.muted = true;
        document.getElementById('video-grid').appendChild(localVideo);
    }
    localVideo.srcObject = new MediaStream([videoTrack]);

    // Merge video track into the existing local audio stream
    if (localStream) {
        const oldVideoTrack = localStream.getVideoTracks()[0];
        if (oldVideoTrack) {
            localStream.removeTrack(oldVideoTrack);
            oldVideoTrack.stop();
        }
        localStream.addTrack(videoTrack);
    } else {
        localStream = newStream;
    }

    // Update peers
    for (const peer of Object.values(peerConnections)) {
        const sender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
            sender.replaceTrack(videoTrack);
        } else {
            peer.addTrack(videoTrack, localStream);
        }
    }
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        addStreamToPeers(stream);
    } catch (err) {
        alert("Camera access denied.");
    }
}

async function startScreenShare() {
    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        addStreamToPeers(stream);
    } catch (err) {
        alert("Screen sharing canceled.");
    }
}

function joinVoiceChannel(channelName) {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
            localStream = stream;
            socket.send(JSON.stringify({ type: 'join-voice', channel: channelName }));
        })
        .catch(err => alert("Microphone access denied."));
}

function createPeerConnection(targetUser) {
    const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    const peer = new RTCPeerConnection(rtcConfig);

    if (localStream) {
        localStream.getTracks().forEach(track => peer.addTrack(track, localStream));
    }

    // NEW: Tell the other person when we add a camera late
    peer.onnegotiationneeded = async () => {
        try {
            // Prevent collisions if we are already processing a connection
            if (peer.signalingState !== "stable") return;
            
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            socket.send(JSON.stringify({ type: 'webrtc-offer', target: targetUser, offer: peer.localDescription }));
        } catch (e) { console.error(e); }
    };

    peer.onicecandidate = (event) => {
        if (event.candidate) {
            socket.send(JSON.stringify({ type: 'webrtc-ice', target: targetUser, candidate: event.candidate }));
        }
    };

    peer.ontrack = (event) => {
        const track = event.track;
        
        if (track.kind === 'audio') {
            let audioEl = document.getElementById('audio-' + targetUser);
            if (!audioEl) {
                audioEl = document.createElement('audio');
                audioEl.id = 'audio-' + targetUser;
                audioEl.autoplay = true;
                document.body.appendChild(audioEl);
            }
            // Explicitly package the track
            if (!audioEl.srcObject) audioEl.srcObject = new MediaStream([track]);
            
        } else if (track.kind === 'video') {
            let videoEl = document.getElementById('video-' + targetUser);
            if (!videoEl) {
                videoEl = document.createElement('video');
                videoEl.id = 'video-' + targetUser;
                videoEl.autoplay = true;
                
                document.getElementById('video-modal').style.display = 'flex';
                document.getElementById('video-grid').appendChild(videoEl);
            }
            // Explicitly package the track
            if (!videoEl.srcObject) videoEl.srcObject = new MediaStream([track]);
        }
    };

    peerConnections[targetUser] = peer;
    return peer;
}

// --- WebSocket & Chat Logic ---

function establishWebSocket(username) {
    // Updated to use the secure WSS domain
    socket = new WebSocket('wss://betterchat.cloudns.ch:8081');
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
                
                const isImage = /\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i.test(data.message);
                
                if (isImage) {
                    msgDiv.innerHTML = `<strong>${data.username}:</strong><br><img src="${data.message}" style="max-width: 100%; border-radius: 10px; margin-top: 5px;">`;
                } else {
                    msgDiv.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
                }
                
                chatHistory.appendChild(msgDiv);
                chatHistory.scrollTop = chatHistory.scrollHeight; 
            } else if (data.type === 'voice-users') {
                document.querySelectorAll('.channel-users').forEach(el => el.innerHTML = '');
                for (const [channel, users] of Object.entries(data.channels)) {
                    const userDiv = document.getElementById('voice-users-' + channel);
                    if (userDiv && users.length > 0) userDiv.textContent = users.join(', ');
                }
            } else if (data.type === 'user-joined-voice') {
                createPeerConnection(data.username);
            } else if (data.type === 'webrtc-offer') {
                let peer = peerConnections[data.sender];
                if (!peer) {
                    peer = createPeerConnection(data.sender);
                }
                
                await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);
                socket.send(JSON.stringify({ type: 'webrtc-answer', target: data.sender, answer: peer.localDescription }));
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