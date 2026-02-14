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
            // If login is successful, hide the login form
            document.querySelector('.login-container').style.display = 'none';
            establishWebSocket();
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
function establishWebSocket() {
    // Create a new WebSocket connection.
    // The 'wss' protocol is used for secure WebSockets.
    const socket = new WebSocket('ws://mayflowerparadise.cloud-ip.cc:8081/chat');

    // Event listener for when the connection is opened
    socket.onopen = function(event) {
        console.log('WebSocket connection established.');
        // You can now send messages to the server
        socket.send(prompt("Please enter your message:"));
    };

    // Event listener for receiving messages from the server
    socket.onmessage = function(event) {
        console.log('Message from server: ', event.data);
        // Here you would handle incoming chat messages,
        // and display them on the page.
    };

    // Event listener for handling errors
    socket.onerror = function(error) {
        console.error('WebSocket Error: ', error);
    };

    // Event listener for when the connection is closed
    socket.onclose = function(event) {
        if (event.wasClean) {
            console.log(`WebSocket connection closed cleanly, code=${event.code} reason=${event.reason}`);
        } else {
            // e.g. server process killed or network down
            // event.code is usually 1006 in this case
            console.error('WebSocket connection died');
        }
    };
}
