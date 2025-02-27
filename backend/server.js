// backend.js
require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Connection
const client = new MongoClient(process.env.MONGODB_URI);
let db;

async function connectDB() {
    try {
        await client.connect();
        db = client.db();
        console.log('Connected to MongoDB');
        
        // Create unique indexes
        await db.collection('users').createIndex({ username: 1 }, { unique: true });
        await db.collection('users').createIndex({ email: 1 }, { unique: true });
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
}

connectDB();

// API Endpoints
app.post('/api/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const users = db.collection('users');

        // Check existing user
        const existingUser = await users.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Username or email already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        const result = await users.insertOne({
            username,
            email,
            password: hashedPassword,
            createdAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            userId: result.insertedId
        });

    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration'
        });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const users = db.collection('users');

        // Find user
        const user = await users.findOne({ username });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id.toString() },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            username: user.username
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});