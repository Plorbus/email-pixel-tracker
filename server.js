const express = require('express');
const app = express();
const PORT = 3000;
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

app.get('/pixel', (req,res) =>{
    console.log(`Pixel requested at ${new Date().toISOString()}`);
    res.set('Content-Type', 'image/gif');
    res.send(PIXEL);
});

app.listen(PORT,() => {
    console.log(`Server listening on http://localhost:${PORT}`);
});