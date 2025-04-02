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
const { isLoggedIn } = require("./middleware");
const MONGO_URL = "mongodb://127.0.0.1:27017/farmers";
const dashboardRoutes = require("./routes/dashboard");
const Listing = require("./models/listing");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const Order = require("./models/order");

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

app.get("/sell", isLoggedIn, (req, res) => {
  res.render("sell.ejs");
});

app.get("/buy", async (req, res) => {
  const listings = await Listing.find({});
  res.render("buy.ejs", { listings });
});

app.get("/profile", isLoggedIn, (req, res) => {
  res.render("profile.ejs");
});

app.get("/signup", (req, res) => {
  res.render("signup.ejs");
});

app.get("/kyc", isLoggedIn, (req, res) => {
  res.render("kyc.ejs");
});

app.get("/orders", isLoggedIn, async (req, res) => {
  const orders = await Order.find({ buyer: req.user._id }).populate("crop");
  res.render("view-orders.ejs", { orders });
});

app.get("/order/:id", isLoggedIn, async (req, res) => {
  const crop = await Listing.findById(req.params.id);
  res.render("order.ejs", { crop });
});

app.post("/order/:id", isLoggedIn, async (req, res) => {
  const crop = await Listing.findById(req.params.id);
  const quantity = req.body.quantity;
  const totalPrice = quantity * crop.price;

  const order = new Order({
    crop: crop._id,
    buyer: req.user._id,
    seller: Listing.owner,
    quantity,
    totalPrice,
  });

  await order.save();
  req.flash("success", "Order placed successfully!");
  res.redirect("/orders");
});

app.post("/profile/edit", isLoggedIn, async (req, res) => {
  const { username, email, phone, address } = req.body;
  try {
    const user = await User.findById(req.user._id);
    user.username = username;
    user.email = email;
    user.phone = phone;
    user.address = address;
    await user.save();
    req.flash("success", "Profile updated successfully!");
    res.redirect("/profile");
  } catch (err) {
    console.error("Error updating profile:", err);
    req.flash("error", "Failed to update profile");
    res.redirect("/profile");
  }
});

app.post("/profile/delete", isLoggedIn, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    req.logout((err) => {
      if (err) return next(err);
      req.flash("success", "Account deleted successfully.");
      res.redirect("/");
    });
  } catch (err) {
    console.error("Error deleting account:", err);
    req.flash("error", "Failed to delete account.");
    res.redirect("/profile");
  }
});

app.post("/kyc", isLoggedIn, upload.single("idProof"), (req, res) => {
  if (!req.file) {
    req.flash("error", "Please upload a valid ID proof.");
    return res.redirect("/kyc");
  }
  req.flash("success", "KYC submitted successfully!");

  res.redirect("/profile");
});

app.post("/sell", isLoggedIn, async (req, res) => {
  try {
    const { title, description, category, location, price, image } = req.body;
    const newListing = new Listing({
      title,
      description,
      category,
      location,
      price: Number(price),
      image,
      owner: req.user.username,
    });
    await newListing.save();
    req.flash("success", "Your crop has been listed!");
    res.redirect("/buy");
  } catch (err) {
    console.log("Error while selling:", err);
    req.flash("error", "Failed to list your crop.");
    res.redirect("/sell");
  }
});

app.post("/signup", async (req, res, next) => {
  try {
    const { username, email, password, profileImage, phone, address, role } =
      req.body;
    const user = new User({
      username,
      email,
      profileImage: profileImage || undefined,
      phone,
      address,
      role,
    });
    const registeredUser = await User.register(user, password);
    req.login(registeredUser, (err) => {
      if (err) return next(err);
      req.flash("success", "Welcome to Farmer's Marketplace!");
      res.redirect("/");
    });
  } catch (e) {
    console.log("Signup Error:", e); // helpful for debugging
    req.flash("error", e.message);
    res.redirect("/signup");
  }
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.post(
  "/login",
  passport.authenticate("local", {
    failureFlash: true,
    failureRedirect: "/login",
  }),
  (req, res) => {
    req.flash("success", "Welcome back!");
    res.redirect("/");
  }
);

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.flash("success", "Logged out successfully");
    res.redirect("/");
  });
});

app.get("/prices", (req, res) => {
  const crops = [
    { name: "Wheat", image: "/images/wheat.png", currentPrice: 24 },
    { name: "Rice", image: "/images/rice.png", currentPrice: 30 },
    { name: "Corn", image: "/images/corn.png", currentPrice: 20 },
    { name: "Barley", image: "/images/barley.png", currentPrice: 25 },
    { name: "Soybean", image: "/images/soybean.png", currentPrice: 30 },
    { name: "Oats", image: "/images/oats.png", currentPrice: 24 },
    { name: "Sorghum", image: "/images/sorghum.png", currentPrice: 19 },
    { name: "Millet", image: "/images/millet.png", currentPrice: 23 },
    { name: "Peanuts", image: "/images/peanuts.png", currentPrice: 28 },
    { name: "Cotton", image: "/images/cotton.png", currentPrice: 35 },
    { name: "Sugarcane", image: "/images/sugarcane.png", currentPrice: 15 },
    { name: "Sunflower", image: "/images/sunflower.png", currentPrice: 26 },
    { name: "Chickpeas", image: "/images/chickpeas.png", currentPrice: 27 },
    { name: "Lentils", image: "/images/lentils.png", currentPrice: 29 },
    {
      name: "Kidney Beans",
      image: "/images/kidney_beans.png",
      currentPrice: 30,
    },
    { name: "Black Beans", image: "/images/black_beans.png", currentPrice: 32 },
    { name: "Green Beans", image: "/images/green_beans.png", currentPrice: 21 },
    { name: "Tomatoes", image: "/images/tomatoes.png", currentPrice: 16 },
    { name: "Potatoes", image: "/images/potatoes.png", currentPrice: 17 },
    { name: "Onions", image: "/images/onions.png", currentPrice: 18 },
    { name: "Carrots", image: "/images/carrots.png", currentPrice: 15 },
    { name: "Cabbage", image: "/images/cabbage.png", currentPrice: 16 },
    { name: "Broccoli", image: "/images/broccoli.png", currentPrice: 22 },
    { name: "Cauliflower", image: "/images/cauliflower.png", currentPrice: 20 },
    { name: "Spinach", image: "/images/spinach.png", currentPrice: 18 },
    { name: "Lettuce", image: "/images/lettuce.png", currentPrice: 17 },
    { name: "Cucumber", image: "/images/cucumber.png", currentPrice: 14 },
    {
      name: "Bell Peppers",
      image: "/images/bell_peppers.png",
      currentPrice: 19,
    },
    { name: "Eggplant", image: "/images/eggplant.png", currentPrice: 15 },
    { name: "Pumpkin", image: "/images/pumpkin.png", currentPrice: 23 },
    { name: "Zucchini", image: "/images/zucchini.png", currentPrice: 16 },
    { name: "Apples", image: "/images/apples.png", currentPrice: 35 },
    { name: "Bananas", image: "/images/bananas.png", currentPrice: 12 },
    { name: "Oranges", image: "/images/oranges.png", currentPrice: 18 },
    { name: "Mangoes", image: "/images/mangoes.png", currentPrice: 40 },
    { name: "Grapes", image: "/images/grapes.png", currentPrice: 30 },
    { name: "Pineapple", image: "/images/pineapple.png", currentPrice: 28 },
    {
      name: "Strawberries",
      image: "/images/strawberries.png",
      currentPrice: 45,
    },
    { name: "Blueberries", image: "/images/blueberries.png", currentPrice: 50 },
    { name: "Watermelon", image: "/images/watermelon.png", currentPrice: 20 },
    { name: "Papaya", image: "/images/papaya.png", currentPrice: 25 },
    { name: "Guava", image: "/images/guava.png", currentPrice: 22 },
    { name: "Pear", image: "/images/pear.png", currentPrice: 24 },
    { name: "Lychee", image: "/images/lychee.png", currentPrice: 36 },
    { name: "Plum", image: "/images/plum.png", currentPrice: 27 },
    { name: "Peach", image: "/images/peach.png", currentPrice: 29 },
    { name: "Cherry", image: "/images/cherry.png", currentPrice: 42 },
    { name: "Kiwi", image: "/images/kiwi.png", currentPrice: 38 },
    { name: "Avocado", image: "/images/avocado.png", currentPrice: 44 },
    { name: "Coconut", image: "/images/coconut.png", currentPrice: 31 },
    { name: "Pomegranate", image: "/images/pomegranate.png", currentPrice: 33 },
    {
      name: "Sweet Potato",
      image: "/images/sweet_potato.png",
      currentPrice: 19,
    },
    { name: "Beetroot", image: "/images/beetroot.png", currentPrice: 21 },
    { name: "Okra", image: "/images/okra.png", currentPrice: 16 },
    {
      name: "Bitter Gourd",
      image: "/images/bitter_gourd.png",
      currentPrice: 17,
    },
    {
      name: "Bottle Gourd",
      image: "/images/bottle_gourd.png",
      currentPrice: 15,
    },
    {
      name: "Cluster Beans",
      image: "/images/cluster_beans.png",
      currentPrice: 20,
    },
    { name: "Green Peas", image: "/images/green_peas.png", currentPrice: 22 },
    { name: "Mushroom", image: "/images/mushroom.png", currentPrice: 32 },
    { name: "Radish", image: "/images/radish.png", currentPrice: 14 },
    { name: "Turnip", image: "/images/turnip.png", currentPrice: 15 },
    { name: "Garlic", image: "/images/garlic.png", currentPrice: 34 },
    { name: "Ginger", image: "/images/ginger.png", currentPrice: 31 },
    {
      name: "Mustard Seeds",
      image: "/images/mustard_seeds.png",
      currentPrice: 25,
    },
    { name: "Fenugreek", image: "/images/fenugreek.png", currentPrice: 18 },
    { name: "Basil", image: "/images/basil.png", currentPrice: 27 },
    { name: "Mint", image: "/images/mint.png", currentPrice: 19 },
    { name: "Coriander", image: "/images/coriander.png", currentPrice: 20 },
    { name: "Parsley", image: "/images/parsley.png", currentPrice: 23 },
    { name: "Celery", image: "/images/celery.png", currentPrice: 21 },
    { name: "Arugula", image: "/images/arugula.png", currentPrice: 26 },
    { name: "Chia Seeds", image: "/images/chia_seeds.png", currentPrice: 39 },
    { name: "Flax Seeds", image: "/images/flax_seeds.png", currentPrice: 28 },
    {
      name: "Sesame Seeds",
      image: "/images/sesame_seeds.png",
      currentPrice: 24,
    },
    { name: "Almonds", image: "/images/almonds.png", currentPrice: 55 },
    { name: "Walnuts", image: "/images/walnuts.png", currentPrice: 52 },
    { name: "Cashews", image: "/images/cashews.png", currentPrice: 58 },
    { name: "Pistachios", image: "/images/pistachios.png", currentPrice: 60 },
    { name: "Hazelnuts", image: "/images/hazelnuts.png", currentPrice: 50 },
    { name: "Macadamia", image: "/images/macadamia.png", currentPrice: 65 },
    { name: "Raspberry", image: "/images/raspberry.png", currentPrice: 48 },
    { name: "Blackberry", image: "/images/blackberry.png", currentPrice: 47 },
    { name: "Gooseberry", image: "/images/gooseberry.png", currentPrice: 25 },
    { name: "Sapota", image: "/images/sapota.png", currentPrice: 24 },
    { name: "Jackfruit", image: "/images/jackfruit.png", currentPrice: 30 },
    { name: "Tamarind", image: "/images/tamarind.png", currentPrice: 29 },
    { name: "Durian", image: "/images/durian.png", currentPrice: 70 },
    { name: "Mangosteen", image: "/images/mangosteen.png", currentPrice: 68 },
    { name: "Rambutan", image: "/images/rambutan.png", currentPrice: 63 },
    {
      name: "Dragon Fruit",
      image: "/images/dragon_fruit.png",
      currentPrice: 49,
    },
    { name: "Star Fruit", image: "/images/star_fruit.png", currentPrice: 46 },
    {
      name: "Passion Fruit",
      image: "/images/passion_fruit.png",
      currentPrice: 53,
    },
    { name: "Fig", image: "/images/fig.png", currentPrice: 41 },
    { name: "Date", image: "/images/date.png", currentPrice: 45 },
    { name: "Olives", image: "/images/olives.png", currentPrice: 38 },
    { name: "Saffron", image: "/images/saffron.png", currentPrice: 150 },
    { name: "Tea Leaves", image: "/images/tea_leaves.png", currentPrice: 35 },
    {
      name: "Coffee Beans",
      image: "/images/coffee_beans.png",
      currentPrice: 55,
    },
    { name: "Quinoa", image: "/images/quinoa.png", currentPrice: 42 },
    { name: "Barley", image: "/images/barley.png", currentPrice: 18 },
    { name: "Rye", image: "/images/rye.png", currentPrice: 20 },
    { name: "Sorghum", image: "/images/sorghum.png", currentPrice: 22 },
    { name: "Millet", image: "/images/millet.png", currentPrice: 21 },
    { name: "Amaranth", image: "/images/amaranth.png", currentPrice: 25 },
    { name: "Spelt", image: "/images/spelt.png", currentPrice: 24 },
    { name: "Kamut", image: "/images/kamut.png", currentPrice: 26 },
    { name: "Farro", image: "/images/farro.png", currentPrice: 28 },
    { name: "Buckwheat", image: "/images/buckwheat.png", currentPrice: 23 },
    { name: "Wild Rice", image: "/images/wild_rice.png", currentPrice: 30 },
    { name: "Red Rice", image: "/images/red_rice.png", currentPrice: 27 },
    { name: "Black Rice", image: "/images/black_rice.png", currentPrice: 29 },
    { name: "Lemongrass", image: "/images/lemongrass.png", currentPrice: 19 },
    { name: "Bay Leaves", image: "/images/bay_leaves.png", currentPrice: 17 },
    { name: "Cinnamon", image: "/images/cinnamon.png", currentPrice: 35 },
    { name: "Clove", image: "/images/clove.png", currentPrice: 38 },
    { name: "Nutmeg", image: "/images/nutmeg.png", currentPrice: 40 },
    { name: "Cardamom", image: "/images/cardamom.png", currentPrice: 50 },
    {
      name: "Vanilla Beans",
      image: "/images/vanilla_beans.png",
      currentPrice: 90,
    },
    { name: "Rosemary", image: "/images/rosemary.png", currentPrice: 18 },
    { name: "Thyme", image: "/images/thyme.png", currentPrice: 16 },
    { name: "Oregano", image: "/images/oregano.png", currentPrice: 19 },
    { name: "Sage", image: "/images/sage.png", currentPrice: 22 },
    { name: "Dill", image: "/images/dill.png", currentPrice: 20 },
    { name: "Leek", image: "/images/leek.png", currentPrice: 25 },
    { name: "Shallots", image: "/images/shallots.png", currentPrice: 23 },
    { name: "Artichoke", image: "/images/artichoke.png", currentPrice: 30 },
    { name: "Asparagus", image: "/images/asparagus.png", currentPrice: 34 },
    {
      name: "Brussels Sprouts",
      image: "/images/brussels_sprouts.png",
      currentPrice: 32,
    },
    { name: "Kale", image: "/images/kale.png", currentPrice: 28 },
    {
      name: "Collard Greens",
      image: "/images/collard_greens.png",
      currentPrice: 26,
    },
    { name: "Swiss Chard", image: "/images/swiss_chard.png", currentPrice: 24 },
    { name: "Endive", image: "/images/endive.png", currentPrice: 20 },
    { name: "Radicchio", image: "/images/radicchio.png", currentPrice: 21 },
    { name: "Fennel", image: "/images/fennel.png", currentPrice: 22 },
    { name: "Horseradish", image: "/images/horseradish.png", currentPrice: 27 },
    {
      name: "Water Chestnut",
      image: "/images/water_chestnut.png",
      currentPrice: 29,
    },
    { name: "Jicama", image: "/images/jicama.png", currentPrice: 26 },
    { name: "Taro Root", image: "/images/taro_root.png", currentPrice: 25 },
    { name: "Lotus Root", image: "/images/lotus_root.png", currentPrice: 31 },
    { name: "Cranberry", image: "/images/cranberry.png", currentPrice: 40 },
    { name: "Blueberry", image: "/images/blueberry.png", currentPrice: 45 },
    { name: "Elderberry", image: "/images/elderberry.png", currentPrice: 35 },
    { name: "Mulberry", image: "/images/mulberry.png", currentPrice: 37 },
    { name: "Pecan", image: "/images/pecan.png", currentPrice: 52 },
    { name: "Brazil Nut", image: "/images/brazil_nut.png", currentPrice: 54 },
    { name: "Pine Nut", image: "/images/pine_nut.png", currentPrice: 60 },
    { name: "Kiwifruit", image: "/images/kiwifruit.png", currentPrice: 33 },
    { name: "Guava", image: "/images/guava.png", currentPrice: 18 },
    { name: "Persimmon", image: "/images/persimmon.png", currentPrice: 22 },
    { name: "Lychee", image: "/images/lychee.png", currentPrice: 25 },
    { name: "Rambutan", image: "/images/rambutan.png", currentPrice: 27 },
    {
      name: "Dragon Fruit",
      image: "/images/dragon_fruit.png",
      currentPrice: 30,
    },
    {
      name: "Passion Fruit",
      image: "/images/passion_fruit.png",
      currentPrice: 32,
    },
    { name: "Star Fruit", image: "/images/star_fruit.png", currentPrice: 29 },
    { name: "Sapodilla", image: "/images/sapodilla.png", currentPrice: 24 },
    { name: "Mulukhiyah", image: "/images/mulukhiyah.png", currentPrice: 21 },
    { name: "Okra", image: "/images/okra.png", currentPrice: 19 },
    { name: "Chayote", image: "/images/chayote.png", currentPrice: 23 },
    { name: "Yam", image: "/images/yam.png", currentPrice: 26 },
    { name: "Cassava", image: "/images/cassava.png", currentPrice: 24 },
    { name: "Salsify", image: "/images/salsify.png", currentPrice: 28 },
    { name: "Parsnip", image: "/images/parsnip.png", currentPrice: 25 },
    { name: "Turnip", image: "/images/turnip.png", currentPrice: 22 },
    { name: "Rutabaga", image: "/images/rutabaga.png", currentPrice: 23 },
    { name: "Ginger", image: "/images/ginger.png", currentPrice: 35 },
    { name: "Turmeric", image: "/images/turmeric.png", currentPrice: 37 },
    { name: "Galangal", image: "/images/galangal.png", currentPrice: 34 },
    { name: "Wasabi", image: "/images/wasabi.png", currentPrice: 55 },
    {
      name: "Mustard Seeds",
      image: "/images/mustard_seeds.png",
      currentPrice: 20,
    },
    { name: "Caraway", image: "/images/caraway.png", currentPrice: 22 },
    {
      name: "Coriander Seeds",
      image: "/images/coriander_seeds.png",
      currentPrice: 18,
    },
    { name: "Fenugreek", image: "/images/fenugreek.png", currentPrice: 20 },
    { name: "Poppy Seeds", image: "/images/poppy_seeds.png", currentPrice: 24 },
    { name: "Chia Seeds", image: "/images/chia_seeds.png", currentPrice: 30 },
    { name: "Flax Seeds", image: "/images/flax_seeds.png", currentPrice: 28 },
    { name: "Hemp Seeds", image: "/images/hemp_seeds.png", currentPrice: 35 },
    {
      name: "Sesame Seeds",
      image: "/images/sesame_seeds.png",
      currentPrice: 27,
    },
    { name: "Coconut", image: "/images/coconut.png", currentPrice: 33 },
    { name: "Palm Fruit", image: "/images/palm_fruit.png", currentPrice: 29 },
    { name: "Sago", image: "/images/sago.png", currentPrice: 26 },
    { name: "Tamarind", image: "/images/tamarind.png", currentPrice: 30 },
    {
      name: "Baobab Fruit",
      image: "/images/baobab_fruit.png",
      currentPrice: 38,
    },
    { name: "Goji Berry", image: "/images/goji_berry.png", currentPrice: 42 },
    { name: "Seaweed", image: "/images/seaweed.png", currentPrice: 35 },
    { name: "Nori", image: "/images/nori.png", currentPrice: 33 },
    { name: "Spirulina", image: "/images/spirulina.png", currentPrice: 45 },
    { name: "Almond", image: "/images/almond.png", currentPrice: 48 },
    { name: "Hazelnut", image: "/images/hazelnut.png", currentPrice: 50 },
    { name: "Macadamia", image: "/images/macadamia.png", currentPrice: 55 },
    { name: "Walnut", image: "/images/walnut.png", currentPrice: 47 },
    { name: "Chestnut", image: "/images/chestnut.png", currentPrice: 43 },
    { name: "Peanut", image: "/images/peanut.png", currentPrice: 25 },
    { name: "Soybean", image: "/images/soybean.png", currentPrice: 30 },
    { name: "Lentils", image: "/images/lentils.png", currentPrice: 22 },
    { name: "Chickpeas", image: "/images/chickpeas.png", currentPrice: 27 },
    { name: "Black Beans", image: "/images/black_beans.png", currentPrice: 26 },
  ];
  res.render("marketprice", { crops });
});

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
