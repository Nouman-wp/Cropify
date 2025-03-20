const express = require('express');
const router = express.Router();
const Crop = require('../models/crop'); // Your Crop model
const { isLoggedIn } = require('../middleware'); // Protect route


router.get('/dashboard', isLoggedIn, async (req, res) => {
  try {
    const crops = await Crop.find({ seller: req.user._id });
    res.render('dashboard', { user: req.user, crops });
  } catch (err) {
    console.error(err);
    res.redirect('/');
  }
});

module.exports = router;
