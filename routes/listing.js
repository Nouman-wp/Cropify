const express = require("express");
const router = express.Router();
const Listing = require("../models/listing");


router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const listing = await Listing.findById(id);
        if (!listing) {
            return res.status(404).send("Listing not found");
        }
        res.render("buy-details", { listing });
    } catch (error) {
        console.error(error);
        res.status(500).send("Something went wrong");
    }
});

module.exports = router;
