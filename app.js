const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const session = require("express-session");
const flash = require("connect-flash");
const ExpressError = require("./utils/ExpressError");
const { data: listings } = require("./ini/data");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user");
const { isLoggedIn } = require('./middleware'); 
const MONGO_URL = "mongodb://127.0.0.1:27017/farmers";
const dashboardRoutes = require('./routes/dashboard');
const Listing = require("./models/listing");
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // You can configure storage later





// Database connection
async function main() {
    try {
        await mongoose.connect(MONGO_URL);
        console.log("Connected to the Database");
    } catch (err) {
        console.error("Database connection error:", err);
    }
}
main();

// Middleware setup
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "/public")));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.engine("ejs", ejsMate);

// Session configuration
const sessionOptions = {
    secret: "myrandomsecret",
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
    },
};
app.use(session(sessionOptions));
app.use(flash());



// Passport.js setup (order is important)
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Store current user and flash messages in all templates
app.use((req, res, next) => {
    res.locals.currentUser = req.user || null;
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    next();
});

// Routes
app.use(dashboardRoutes);

app.get("/", (req, res) => {
    res.render("home.ejs");
});

app.get('/sell', isLoggedIn, (req, res) => {
    res.render('sell.ejs');
});


app.get('/buy', async (req, res) => {
    const listings = await Listing.find({});
    res.render('buy.ejs', { listings });
});

app.get('/profile', isLoggedIn, (req, res) => {
    res.render('profile.ejs'); 
});

app.get('/signup', (req, res) => {
    res.render('signup.ejs');
});

app.get('/kyc', isLoggedIn, (req, res) => {
    res.render('kyc.ejs');
});


app.post('/profile/edit', isLoggedIn, async (req, res) => {
    const { username, email, phone, address } = req.body;
    try {
        const user = await User.findById(req.user._id);
        user.username = username;
        user.email = email;
        user.phone = phone;
        user.address = address;
        await user.save();
        req.flash('success', 'Profile updated successfully!');
        res.redirect('/profile');
    } catch (err) {
        console.error('Error updating profile:', err);
        req.flash('error', 'Failed to update profile');
        res.redirect('/profile');
    }
});

app.post('/profile/delete', isLoggedIn, async (req, res) => {
    try {
        await User.findByIdAndDelete(req.user._id);
        req.logout(err => {
            if (err) return next(err);
            req.flash('success', 'Account deleted successfully.');
            res.redirect('/');
        });
    } catch (err) {
        console.error('Error deleting account:', err);
        req.flash('error', 'Failed to delete account.');
        res.redirect('/profile');
    }
});

app.post('/kyc', isLoggedIn, upload.single('idProof'), (req, res) => {
    if (!req.file) {
        req.flash('error', 'Please upload a valid ID proof.');
        return res.redirect('/kyc');
    }
    req.flash('success', 'KYC submitted successfully!');
   
    res.redirect('/profile');
});




app.post('/sell', isLoggedIn, async (req, res) => {
    try {
        const { title, description, category, location, price, image } = req.body;
        const newListing = new Listing({
            title,
            description,
            category,
            location,
            price: Number(price),
            image,
            owner: req.user.username  
        });
        await newListing.save();
        req.flash('success', 'Your crop has been listed!');
        res.redirect('/buy');
    } catch (err) {
        console.log("Error while selling:", err);
        req.flash('error', 'Failed to list your crop.');
        res.redirect('/sell');
    }
});



app.post('/signup', async (req, res, next) => {
    try {
        const { username, email, password, profileImage, phone, address, role } = req.body;
        const user = new User({ 
            username, 
            email, 
            profileImage: profileImage || undefined,
            phone,
            address,
            role
        });
        const registeredUser = await User.register(user, password);
        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash('success', 'Welcome to Farmer\'s Marketplace!');
            res.redirect('/');
        });
    } catch (e) {
        console.log("Signup Error:", e);  // helpful for debugging
        req.flash('error', e.message);
        res.redirect('/signup');
    }
});



app.get('/login', (req, res) => {
    res.render('login.ejs');
});

app.post('/login', passport.authenticate('local', {
    failureFlash: true,
    failureRedirect: '/login'
}), (req, res) => {
    req.flash('success', 'Welcome back!');
    res.redirect('/');
});

app.get('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);
        req.flash('success', 'Logged out successfully');
        res.redirect('/');
    });
});



// function isLoggedIn(req, res, next) {
//     if (req.isAuthenticated()) return next();
//     res.redirect('/login');
// }

// Catch all route for undefined paths
app.all("*", (req, res, next) => {
    next(new ExpressError(404, "Page Not Found"));
});


app.use((err, req, res, next) => {
    const { statusCode = 500, message = "Something Went Wrong" } = err;
    res.status(statusCode).render("error.ejs", { message });
});


app.listen(3000, () => {
    console.log("Server is running on port http://localhost:3000");
});
