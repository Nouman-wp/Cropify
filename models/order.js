const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderSchema = new Schema({
    crop: { type: Schema.Types.ObjectId, ref: 'Listing' },
    buyer: { type: Schema.Types.ObjectId, ref: 'User' },
    seller: { type: Schema.Types.ObjectId, ref: 'User' },
    quantity: Number,
    totalPrice: Number,
    status: { type: String, default: 'Pending' }, // 'Pending', 'Completed', 'Cancelled'
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
