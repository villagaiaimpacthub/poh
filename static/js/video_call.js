// WebRTC Video Call for Proof of Humanity Verification
// This file handles the peer-to-peer WebRTC connection for verification video calls

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const muteButton = document.getElementById('mute-btn');
    const videoToggleButton = document.getElementById('video-toggle-btn');
    const endCallButton = document.getElementById('end-call-btn');
    const completeVerificationButton = document.getElementById('complete-verification-btn');
    const connectionStatus = document.getElementById('connection-status');
    const waitingRoom = document.getElementById('waiting-room');
    const videoCall = document.getElementById('video-call');
    const resultModal = document.getElementById('result-modal');
    const closeModalButton = document.querySelector('.close-modal');
    const resultTitle = document.getElementById('result-title');
    const resultMessage = document.getElementById('result-message');
    const checkboxes = document.querySelectorAll('.verification-checklist input[type="checkbox"]');

    // WebRTC variables
    let peerConnection;
    let localStream;
    let dataChannel;
    let isInitiator = sessionData.isInitiator;
    let isCallActive = false;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 3;

    // Initialize the call
    initializeCall();

    /**
     * Initialize the call and media devices
     */
    async function initializeCall() {
        try {
            // Request access to media devices
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            });
            
            // Display local video
            localVideo.srcObject = localStream;
            
            // Create signaling connection
            connectToSignalingServer();
            
            // Set up UI controls
            setupUIControls();
            
            // Update status
            updateConnectionStatus('connecting');
            
        } catch (error) {
            console.error('Error initializing call:', error);
            updateConnectionStatus('failed', `Failed to access camera/microphone: ${error.message}`);
        }
    }

    /**
     * Connect to the signaling server and set up event listeners
     */
    function connectToSignalingServer() {
        // Create a WebSocket connection to the signaling server
        const socket = new WebSocket(`${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/rtc/${sessionData.roomId}`);
        
        socket.onopen = () => {
            console.log('Connected to signaling server');
            
            // If this user is the initiator, create the offer
            if (isInitiator) {
                createPeerConnection();
                sendSignal('join', { room: sessionData.roomId });
            } else {
                sendSignal('join', { room: sessionData.roomId });
            }
        };
        
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            handleSignalingMessage(message);
        };
        
        socket.onclose = () => {
            console.log('Disconnected from signaling server');
            if (isCallActive) {
                handleDisconnection();
            }
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            updateConnectionStatus('failed', 'Connection to signaling server failed');
        };
        
        // Function to send signals to the signaling server
        function sendSignal(type, data = {}) {
            if (socket.readyState === WebSocket.OPEN) {
                const message = JSON.stringify({
                    type,
                    data: {
                        ...data,
                        room: sessionData.roomId,
                        sessionId: sessionData.sessionId
                    }
                });
                socket.send(message);
            }
        }
        
        // Process signaling messages
        function handleSignalingMessage(message) {
            const { type, data } = message;
            
            switch (type) {
                case 'joined':
                    console.log('A peer joined the room');
                    if (!peerConnection) {
                        createPeerConnection();
                    }
                    break;
                    
                case 'offer':
                    handleOffer(data);
                    break;
                    
                case 'answer':
                    handleAnswer(data);
                    break;
                    
                case 'ice-candidate':
                    handleIceCandidate(data);
                    break;
                    
                case 'user-left':
                    handlePeerDisconnected();
                    break;
                    
                case 'verification-result':
                    handleVerificationResult(data);
                    break;
                    
                default:
                    console.log('Unknown message type:', type);
            }
        }
        
        // Handle WebRTC offer
        async function handleOffer(data) {
            console.log('Received offer');
            if (!peerConnection) {
                createPeerConnection();
            }
            
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                
                sendSignal('answer', { answer });
                updateConnectionStatus('connecting', 'Connecting to peer...');
            } catch (error) {
                console.error('Error handling offer:', error);
                updateConnectionStatus('failed', 'Failed to handle connection offer');
            }
        }
        
        // Handle WebRTC answer
        async function handleAnswer(data) {
            console.log('Received answer');
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            } catch (error) {
                console.error('Error handling answer:', error);
                updateConnectionStatus('failed', 'Failed to establish connection');
            }
        }
        
        // Handle ICE candidate
        function handleIceCandidate(data) {
            console.log('Received ICE candidate');
            try {
                const candidate = new RTCIceCandidate(data.candidate);
                peerConnection.addIceCandidate(candidate);
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
        
        // Handle peer disconnection
        function handlePeerDisconnected() {
            console.log('Peer disconnected');
            updateConnectionStatus('connecting', 'The other participant disconnected');
            showWaitingRoom();
            resetPeerConnection();
        }
        
        // Handle verification result
        function handleVerificationResult(data) {
            console.log('Verification result:', data);
            showResultModal(data.success, data.message);
        }
        
        // Create and configure the RTCPeerConnection
        function createPeerConnection() {
            console.log('Creating peer connection');
            const configuration = {
                iceServers: sessionData.iceServers || [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            };
            
            peerConnection = new RTCPeerConnection(configuration);
            
            // Add local stream tracks to the connection
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
            
            // Set up data channel for messaging
            if (isInitiator) {
                console.log('Creating data channel');
                dataChannel = peerConnection.createDataChannel('verification');
                setupDataChannel(dataChannel);
            } else {
                peerConnection.ondatachannel = (event) => {
                    console.log('Data channel received');
                    dataChannel = event.channel;
                    setupDataChannel(dataChannel);
                };
            }
            
            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    sendSignal('ice-candidate', { candidate: event.candidate });
                }
            };
            
            // Handle connection state changes
            peerConnection.onconnectionstatechange = () => {
                console.log('Connection state:', peerConnection.connectionState);
                
                switch (peerConnection.connectionState) {
                    case 'connected':
                        console.log('Peers connected!');
                        updateConnectionStatus('connected', 'Connected to peer');
                        showVideoCall();
                        isCallActive = true;
                        break;
                        
                    case 'disconnected':
                    case 'failed':
                        handleDisconnection();
                        break;
                        
                    case 'closed':
                        resetPeerConnection();
                        break;
                }
            };
            
            // Handle ICE connection state changes
            peerConnection.oniceconnectionstatechange = () => {
                console.log('ICE connection state:', peerConnection.iceConnectionState);
                
                if (peerConnection.iceConnectionState === 'failed' && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    console.log(`ICE connection failed, attempting reconnection (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                    peerConnection.restartIce();
                }
            };
            
            // Handle track events (remote stream)
            peerConnection.ontrack = (event) => {
                console.log('Remote track received');
                remoteVideo.srcObject = event.streams[0];
            };
            
            // If initiator, create and send offer
            if (isInitiator) {
                createAndSendOffer();
            }
            
            async function createAndSendOffer() {
                try {
                    const offer = await peerConnection.createOffer();
                    await peerConnection.setLocalDescription(offer);
                    
                    sendSignal('offer', { offer });
                } catch (error) {
                    console.error('Error creating offer:', error);
                    updateConnectionStatus('failed', 'Failed to create connection offer');
                }
            }
        }
        
        // Set up the data channel for messaging
        function setupDataChannel(channel) {
            channel.onopen = () => {
                console.log('Data channel opened');
            };
            
            channel.onclose = () => {
                console.log('Data channel closed');
            };
            
            channel.onmessage = (event) => {
                console.log('Data channel message:', event.data);
                const message = JSON.parse(event.data);
                
                if (message.type === 'verification-status') {
                    // Handle verification status updates
                    if (message.data.verified) {
                        // The other user has verified
                        console.log('Other participant has verified');
                    }
                }
            };
        }
        
        // Handle disconnection
        function handleDisconnection() {
            console.log('Connection lost');
            
            if (isCallActive) {
                updateConnectionStatus('connecting', 'Connection lost, waiting for reconnection...');
                
                // If reconnection attempts exceed max, reset the call
                if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                    showWaitingRoom();
                    resetPeerConnection();
                }
            }
        }
        
        // Reset peer connection
        function resetPeerConnection() {
            if (peerConnection) {
                peerConnection.close();
                peerConnection = null;
            }
            
            dataChannel = null;
            isCallActive = false;
            reconnectAttempts = 0;
        }
        
        // Complete verification
        completeVerificationButton.addEventListener('click', () => {
            // Submit verification result to server
            fetch(`/verification/complete_video_session/${sessionData.verificationId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify({
                    sessionId: sessionData.sessionId,
                    verified: true
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Send verification status to peer
                    if (dataChannel && dataChannel.readyState === 'open') {
                        dataChannel.send(JSON.stringify({
                            type: 'verification-status',
                            data: {
                                verified: true
                            }
                        }));
                    }
                    
                    showResultModal(true, 'Verification completed successfully!');
                } else {
                    showResultModal(false, data.message || 'Verification could not be completed');
                }
            })
            .catch(error => {
                console.error('Error completing verification:', error);
                showResultModal(false, 'An error occurred while completing verification');
            });
        });
        
        // End call button
        endCallButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to end the call? This will cancel the verification process.')) {
                // Send verification result to server
                fetch(`/verification/complete_video_session/${sessionData.verificationId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify({
                        sessionId: sessionData.sessionId,
                        verified: false
                    })
                })
                .then(response => response.json())
                .then(data => {
                    // Send verification status to peer
                    if (dataChannel && dataChannel.readyState === 'open') {
                        dataChannel.send(JSON.stringify({
                            type: 'verification-status',
                            data: {
                                verified: false
                            }
                        }));
                    }
                    
                    showResultModal(false, 'Verification was cancelled.');
                    resetPeerConnection();
                    endCall();
                })
                .catch(error => {
                    console.error('Error ending verification:', error);
                    showResultModal(false, 'An error occurred while ending verification');
                    resetPeerConnection();
                    endCall();
                });
            }
        });
        
        // Get CSRF token from cookies
        function getCsrfToken() {
            return document.cookie.split('; ')
                .find(row => row.startsWith('csrf_token='))
                ?.split('=')[1];
        }
    }

    /**
     * Set up UI controls for the call
     */
    function setupUIControls() {
        // Mute button
        muteButton.addEventListener('click', () => {
            const audioTracks = localStream.getAudioTracks();
            if (audioTracks.length === 0) return;
            
            const isAudioEnabled = audioTracks[0].enabled;
            audioTracks[0].enabled = !isAudioEnabled;
            
            // Update UI
            muteButton.innerHTML = isAudioEnabled
                ? '<i class="fas fa-microphone-slash"></i>'
                : '<i class="fas fa-microphone"></i>';
            muteButton.classList.toggle('active');
        });
        
        // Video toggle button
        videoToggleButton.addEventListener('click', () => {
            const videoTracks = localStream.getVideoTracks();
            if (videoTracks.length === 0) return;
            
            const isVideoEnabled = videoTracks[0].enabled;
            videoTracks[0].enabled = !isVideoEnabled;
            
            // Update UI
            videoToggleButton.innerHTML = isVideoEnabled
                ? '<i class="fas fa-video-slash"></i>'
                : '<i class="fas fa-video"></i>';
            videoToggleButton.classList.toggle('active');
        });
        
        // Close modal button
        closeModalButton.addEventListener('click', () => {
            resultModal.style.display = 'none';
        });
        
        // Handle checkbox changes to enable/disable verification button
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateVerificationButtonState);
        });
    }

    /**
     * Update verification button state based on checkboxes
     */
    function updateVerificationButtonState() {
        const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
        completeVerificationButton.disabled = !allChecked;
    }

    /**
     * Update connection status display
     */
    function updateConnectionStatus(status, message = '') {
        connectionStatus.className = 'connection-status ' + status;
        
        switch (status) {
            case 'connecting':
                connectionStatus.textContent = message || 'Connecting...';
                break;
                
            case 'connected':
                connectionStatus.textContent = message || 'Connected';
                break;
                
            case 'failed':
                connectionStatus.textContent = message || 'Connection failed';
                break;
        }
    }

    /**
     * Show the waiting room, hide video call
     */
    function showWaitingRoom() {
        waitingRoom.style.display = 'block';
        videoCall.style.display = 'none';
    }

    /**
     * Show the video call, hide waiting room
     */
    function showVideoCall() {
        waitingRoom.style.display = 'none';
        videoCall.style.display = 'block';
    }

    /**
     * Show result modal with success/failure message
     */
    function showResultModal(success, message) {
        resultTitle.textContent = success ? 'Verification Successful' : 'Verification Failed';
        resultMessage.textContent = message;
        resultModal.style.display = 'block';
    }

    /**
     * End the call and clean up resources
     */
    function endCall() {
        // Stop all tracks
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        
        // Clean up WebRTC connection
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        window.location.href = '/verification/manage';
    }

    // Handle window unload/close
    window.addEventListener('beforeunload', () => {
        if (isCallActive) {
            endCall();
        }
    });
}); 