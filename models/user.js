const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    profileImage: {
        type: String,
        default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' // Default avatar
    },
    role: {
        type: String,
        enum: ['farmer', 'buyer', 'admin'],
        default: 'buyer'
    },
    address: {
        street: String,
        city: String,
        state: String,
        country: String,
        pincode: String
    },
    phone: {
        type: String
    }
}, { timestamps: true });


userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', userSchema);
