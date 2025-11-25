// controllers/quizDisplayController.js
const db = require('../db');
const QRCode = require('qrcode');

// Show QR page on TV
exports.showQuizStart = (req, res) => {
    const qrLink = `http://172.20.10.6:3000/quiz-access`;

    QRCode.toDataURL(qrLink, (err, qrImage) => {
        if (err) return res.send("Error generating QR");

        res.render("quiz-start", { qrImage });
    });
};

exports.showQuizAccess = (req, res) => {
    res.render("quiz-access", { guestMode: false });
};

// Start as guest (create guest session)
exports.startAsGuest = (req, res) => {
    const guestID = "guest_" + Math.floor(Math.random() * 1000000);

    req.session.user = {
        userID: guestID,
        userName: "Guest",
        userType: "Guest"
    };

    // MUST save session before redirect
    req.session.save(() => {
        res.redirect("/guest-welcome");
    });
};
