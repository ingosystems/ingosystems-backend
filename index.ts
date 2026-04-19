import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { Pool } from 'pg';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true, // Use SSL for port 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Routes

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "Product" ORDER BY "createdAt" DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get product by slug
app.get('/api/products/:slug', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "Product" WHERE slug = $1', [req.params.slug]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all case studies
app.get('/api/case-studies', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "CaseStudy" ORDER BY "createdAt" DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching case studies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit contact form
app.post('/api/contact', async (req, res) => {
  console.log('Incoming contact form mission:', req.body);
  try {
    const { name, company, email, phone, message, interest } = req.body;
    
    // Simple validation
    if (!name || !email || !message) {
      console.log('Validation failed:', { name, email, message });
      return res.status(400).json({ error: 'Name, email, and message are required' });
    }

    // Try to save to DB, but don't crash if DB is down
    try {
      console.log('Attempting to create inquiry in DB...');
      const insertQuery = `
        INSERT INTO "Inquiry" (name, company, email, phone, message, interest, "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id
      `;
      const values = [
        name,
        company || '',
        email,
        phone || '',
        message,
        interest || 'General'
      ];
      
      const result = await pool.query(insertQuery, values);
      console.log('DB Inquiry created:', result.rows[0].id);
    } catch (dbError) {
      console.error('Database failed, proceeding with email only:', dbError);
    }

    // Send actual email
    try {
      console.log('Sending email...');
      const mailOptions = {
        from: process.env.SMTP_USER,
        replyTo: email,
        to: process.env.ADMIN_EMAIL,
        subject: `New Inquiry: ${interest} from ${name}`,
        text: `
          New inquiry from your website:
          
          Name: ${name}
          Email: ${email}
          Company: ${company || 'N/A'}
          Phone: ${phone || 'N/A'}
          Interest: ${interest}
          
          Message:
          ${message}
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${process.env.ADMIN_EMAIL}`);
      res.status(200).json({ success: true, message: 'Message sent successfully' });
    } catch (mailError) {
      console.error('Error sending email:', mailError);
      res.status(500).json({ error: 'Failed to send email' });
    }
  } catch (error) {
    console.error('General error in contact form:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('InGo Systems API is running');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
