"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const client_1 = require("@prisma/client");
const nodemailer_1 = __importDefault(require("nodemailer"));
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
dotenv_1.default.config();
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Nodemailer Transporter
const transporter = nodemailer_1.default.createTransport({
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
app.get('/api/products', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const products = yield prisma.product.findMany();
        res.json(products);
    }
    catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// Get product by slug
app.get('/api/products/:slug', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const product = yield prisma.product.findUnique({
            where: { slug: req.params.slug },
        });
        if (!product)
            return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    }
    catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// Get all case studies
app.get('/api/case-studies', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const caseStudies = yield prisma.caseStudy.findMany();
        res.json(caseStudies);
    }
    catch (error) {
        console.error('Error fetching case studies:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// Submit contact form
app.post('/api/contact', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
            const inquiry = yield prisma.inquiry.create({
                data: {
                    name,
                    company: company || '',
                    email,
                    phone: phone || '',
                    message,
                    interest: interest || 'General',
                },
            });
            console.log('DB Inquiry created:', inquiry.id);
        }
        catch (dbError) {
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
            yield transporter.sendMail(mailOptions);
            console.log(`Email sent successfully to ${process.env.ADMIN_EMAIL}`);
            res.status(200).json({ success: true, message: 'Message sent successfully' });
        }
        catch (mailError) {
            console.error('Error sending email:', mailError);
            res.status(500).json({ error: 'Failed to send email' });
        }
    }
    catch (error) {
        console.error('General error in contact form:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}));
// Root endpoint
app.get('/', (req, res) => {
    res.send('InGo Systems API is running');
});
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
