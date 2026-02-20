function javaLikeHashCode(str) {
    let hash = 0;
    if (str.length === 0) {
        return hash;
    }
    for (let i = 0; i < str.length; i++) {
        const charCode = str.charCodeAt(i);
        // Use Math.imul to ensure 32-bit integer multiplication
        hash = Math.imul(31, hash) + charCode;
        // Convert to a 32-bit integer (signed)
        hash |= 0; 
    }
    return hash;
}

// Get the login form element
const loginForm = document.getElementById('login-form');

// Add an event listener for form submission
loginForm.addEventListener('submit', function(event) {
    // Prevent the default form submission behavior
    event.preventDefault();

    // Get the username and password from the form
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Create a data object to send to the server
    const data = {
        username: javaLikeHashCode(username),
        password: javaLikeHashCode(password)
    };

    // Send a POST request to the server for login
    fetch('http://mayflowerparadise.cloud-ip.cc:8082/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Hide login, show glass app
            document.querySelector('.login-container').style.display = 'none';
            document.getElementById('app-wrapper').style.display = 'flex';
            establishWebSocket(username); // Pass username to use later
        } else {
            // If login fails, show an alert
            alert('Login failed: ' + data.message);
        }
    })
    .catch(error => {
        console.error('Error during login:', error);
        alert('Error during login. Please try again later.');
    });
});

/**
 * Establishes a WebSocket connection to the server.
 */
function establishWebSocket(username) {
    const socket = new WebSocket('ws://mayflowerparadise.cloud-ip.cc:8081/chat');
    const chatInput = document.getElementById('chat-input');
    const chatHistory = document.getElementById('chat-history');

    // 1. Send message on Enter key
    chatInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' && chatInput.value.trim() !== '') {
            socket.send(chatInput.value);
            chatInput.value = ''; // Clear input after sending
        }
    });

    socket.onopen = function(event) {
        console.log('WebSocket connection established.');
    };

    // 2. Display incoming messages
    socket.onmessage = function(event) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message';
        msgDiv.textContent = event.data;
        chatHistory.appendChild(msgDiv);
        
        // Auto-scroll to bottom
        chatHistory.scrollTop = chatHistory.scrollHeight;
    };

    socket.onerror = function(error) {
        console.error('WebSocket Error: ', error);
    };

    socket.onclose = function(event) {
        console.log('WebSocket connection closed.');
    };
}