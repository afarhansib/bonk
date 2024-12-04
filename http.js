import { createServer } from 'http';

const server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🌈 Unexpected Test Page</title>
            <style>
                body {
                    background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
                    font-family: 'Comic Sans MS', cursive;
                    height: 100vh;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                }
                .container {
                    text-align: center;
                    animation: bounce 2s infinite;
                }
                @keyframes bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-20px); }
                }
                .dancing-text {
                    font-size: 2em;
                    color: white;
                    text-shadow: 3px 3px 0 #000;
                }
                .potato {
                    font-size: 100px;
                    animation: spin 3s linear infinite;
                }
                @keyframes spin {
                    100% { transform: rotate(360deg); }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="potato">🐤</div>
                <div class="dancing-text">
                    HTTP Server is Working!<br>
                    Here's a spinning chick because... why not?
                </div>
            </div>
        </body>
        </html>
    `);
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
