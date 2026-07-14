function javaLikeHashCode(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        hash = Math.imul(31, hash) + str.charCodeAt(i);
        hash |= 0; 
    }
    return hash;
}

document.getElementById('register-form').addEventListener('submit', function(event) {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const data = {
        username: javaLikeHashCode(username),
        password: javaLikeHashCode(password)
    };

    fetch('https://main.d2x2h8edu7kmss.amplifyapp.com:8082/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Account created! You can now log in.');
            window.location.href = 'index.html'; // Send back to login normal
        } else {
            alert('Registration failed: ' + data.message);
        }
    })
    .catch(error => console.error('Error:', error));
});