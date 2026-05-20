const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
    {
        surveyID: {
            type: String,
            unique: true,
            index: true
        },
        fullName: {
            type: String,
            required: [true, "Full name is required"],
            trim: true,
            minlength: [2, "Full name must be at least 2 characters"]
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"]
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [6, "Password must be at least 6 characters"],
            select: false // Don't return password by default
        },
        // Structured geotron assignments with roles
        assignedGeotrons: [{
	    _id: false,
            geotronName: { type: String, trim: true, uppercase: true },
            role: { type: String, enum: ['LEFT', 'RIGHT', 'MID'] }
        }],
        isActive: { type: Boolean, default: true },
        passwordChangedAt: Date,
    },
    { timestamps: true }
);

// Auto-generate surveyID (U001, U002...) for new users
userSchema.pre("validate", async function () {
    if (this.isNew && !this.surveyID) {
        const count = await mongoose.model("User").countDocuments();
        this.surveyID = `U${String(count + 1).padStart(3, "0")}`;
    }
});

/**
 * Pre-save hook: Hash password before saving to database
 * Only hash if password is new or modified
 */
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = Date.now();
});

/**
 * Instance method: Compare plain password with hashed password during login
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Instance method: Return user data without password for API responses
 */
userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.password;
    return user;
};

module.exports = mongoose.model("User", userSchema);

