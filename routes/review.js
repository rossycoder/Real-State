const express = require('express');
const router = express.Router({ mergeParams: true });
const Property = require('../model/properties');
const Review = require('../model/review');
const { isLoggedIn } = require('../middleware/auth2');

// Create a new review for a property

router.post('/:id/reviews', isLoggedIn, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const review = new Review({
      rating,
      comment,
      user: req.user._id,
      property: id
    });

    await review.save();

    const property = await Property.findByIdAndUpdate(
      id,
      { $push: { reviews: review._id } },
      { new: true }
    );

    res.redirect(`/properties/${id}`);
  } catch (err) {
    console.error('Review creation error:', err);
    res.status(500).json({ error: err.message });
  }
});



// Delete a review (if needed)
router.delete('/:reviewId', isLoggedIn, async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    await Property.findByIdAndUpdate(id, { $pull: { reviews: reviewId } });
    await Review.findByIdAndDelete(reviewId);
    req.flash('success', 'Review deleted successfully!');
    res.redirect(`/properties/${id}`);
  } catch (err) {
    req.flash('error', 'Something went wrong while deleting the review.');
    res.redirect(`/properties/${req.params.id}`);
  }
});

module.exports = router;
