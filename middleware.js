// trans middlewares later
module.exports.isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    req.flash('error', 'Please log in first!');
    res.redirect('/login');
  };
  