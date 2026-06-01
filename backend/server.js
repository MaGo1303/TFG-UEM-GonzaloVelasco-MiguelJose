require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

const isRemote = process.env.DB_HOST && process.env.DB_HOST !== 'localhost';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'royalrent',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ...(isRemote && { ssl: { rejectUnauthorized: false } })
});

const ensureItemsAvailabilityColumn = async () => {
    try {
        await pool.execute('ALTER TABLE items ADD COLUMN is_available BOOLEAN DEFAULT TRUE');
    } catch (error) {
        if (error.code !== 'ER_DUP_FIELDNAME') {
            console.error('Error asegurando columna is_available:', error);
        }
    }
};

const ensureItemImagesTable = async () => {
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS item_images (
                id INT AUTO_INCREMENT PRIMARY KEY,
                item_id INT NOT NULL,
                image_url TEXT NOT NULL,
                position INT DEFAULT 0,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
            )
        `);
        await pool.execute('ALTER TABLE item_images MODIFY image_url TEXT NOT NULL');
    } catch (error) {
        console.error('Error asegurando tabla item_images:', error);
    }
};

const buildVehicleImages = (item, extraImages = []) => {
    const images = extraImages
        .filter(Boolean)
        .filter((url, index, arr) => arr.indexOf(url) === index);

    return images.length > 0 ? images : [item.image_url].filter(Boolean);
};

const attachImagesToItems = async (items) => {
    if (!items.length) return items;
    const itemIds = items.map(item => item.id);
    const placeholders = itemIds.map(() => '?').join(',');
    const [rows] = await pool.execute(
        `SELECT item_id, image_url FROM item_images WHERE item_id IN (${placeholders}) ORDER BY position ASC, id ASC`,
        itemIds
    );
    const imagesByItem = rows.reduce((acc, row) => {
        if (!acc[row.item_id]) acc[row.item_id] = [];
        acc[row.item_id].push(row.image_url);
        return acc;
    }, {});

    return items.map(item => ({
        ...item,
        images: buildVehicleImages(item, imagesByItem[item.id] || []),
    }));
};

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, process.env.JWT_SECRET || 'secret_key', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (password) => password && password.length >= 6;

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
        if (!email || !validateEmail(email)) return res.status(400).json({ error: 'Formato de email inválido' });
        if (!validatePassword(password)) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.execute(
            'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );
        res.status(201).json({ message: 'User registered successfully', userId: result.insertId });
    } catch (error) {
        console.error('Error en /api/register:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'Email already exists' });
        } else {
            res.status(500).json({ error: 'Database error' });
        }
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !validateEmail(email)) return res.status(400).json({ error: 'Formato de email inválido' });
        if (!password) return res.status(400).json({ error: 'La contraseña es obligatoria' });

        const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        console.error('Error en /api/login:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.execute('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });
        res.json(users[0]);
    } catch (error) {
        console.error('Error en /api/user/profile:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/user/profile', authenticateToken, async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await pool.execute('UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?', [name, email, hashedPassword, req.user.id]);
        } else {
            await pool.execute('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.user.id]);
        }
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error en PUT /api/user/profile:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/items', async (req, res) => {
    try {
        const { type } = req.query;
        let query = 'SELECT * FROM items';
        const params = [];

        if (type) {
            query += ' WHERE type = ?';
            params.push(type);
        }

        const [items] = params.length > 0
            ? await pool.execute(query, params)
            : await pool.query(query);
        res.json(await attachImagesToItems(items));
    } catch (error) {
        console.error('Error en /api/items:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/orders', authenticateToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { items, totalPrice } = req.body;

        const [orderResult] = await connection.execute(
            'INSERT INTO orders (user_id, total_price) VALUES (?, ?)',
            [req.user.id, totalPrice]
        );
        const orderId = orderResult.insertId;

        for (const item of items) {
            const [[dbItem]] = await connection.execute(
                'SELECT id, is_available FROM items WHERE id = ? FOR UPDATE',
                [item.id]
            );
            if (!dbItem || !dbItem.is_available) {
                throw new Error(`Item no disponible: ${item.name || item.id}`);
            }
            await connection.execute(
                'INSERT INTO order_items (order_id, item_id, quantity, price, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?)',
                [orderId, item.id, item.quantity, item.price, item.startDate || null, item.endDate || null]
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Order created successfully', orderId });
    } catch (error) {
        console.error('Error en /api/orders:', error);
        await connection.rollback();
        res.status(500).json({ error: 'Failed to create order' });
    } finally {
        connection.release();
    }
});

app.get('/api/orders/history', authenticateToken, async (req, res) => {
    try {
        const [orders] = await pool.execute('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
        for (const order of orders) {
            const [items] = await pool.execute(`
                SELECT oi.*, i.name, i.type, i.image_url
                FROM order_items oi
                JOIN items i ON oi.item_id = i.id
                WHERE oi.order_id = ?
            `, [order.id]);
            order.items = items;
        }
        res.json(orders);
    } catch (error) {
        console.error('Error en /api/orders/history:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '465'),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || ''
    }
});

app.post('/api/contact', async (req, res) => {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try {
        await pool.execute(
            'INSERT INTO messages (name, email, message) VALUES (?, ?, ?)',
            [name, email, message]
        );

        const recipient = process.env.CONTACT_RECIPIENT || 'mj.martinezmajan@gmail.com';
        const isPlaceholder = !process.env.EMAIL_USER ||
                              process.env.EMAIL_USER === 'tu_correo_emisor@gmail.com' ||
                              !process.env.EMAIL_PASS ||
                              process.env.EMAIL_PASS === 'tu_contrase_de_aplicacion_gmail';

        if (!isPlaceholder) {
            try {
                await transporter.sendMail({
                    from: `"RoyalRent Contacto" <${process.env.EMAIL_USER}>`,
                    to: recipient,
                    subject: `Nuevo mensaje de contacto de ${name}`,
                    text: `Nombre: ${name}\nEmail: ${email}\nMensaje: ${message}\nFecha: ${new Date().toLocaleString()}`,
                    html: `
                        <h2>Nuevo mensaje de contacto - RoyalRent</h2>
                        <p><strong>Nombre:</strong> ${name}</p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Mensaje:</strong></p>
                        <blockquote style="background:#f4f4f4;padding:15px;border-left:5px solid #1a2d5a;color:#333">
                            ${message.replace(/\n/g, '<br>')}
                        </blockquote>
                        <p style="font-size:0.8em;color:#777">Recibido el ${new Date().toLocaleString()}</p>
                    `
                });
                res.status(201).json({ message: 'Mensaje guardado y correo enviado correctamente' });
            } catch (emailError) {
                console.error('Error SMTP:', emailError);
                res.status(201).json({
                    message: 'Mensaje guardado, pero falló el envío del correo.'
                });
            }
        } else {
            res.status(201).json({
                message: 'Mensaje guardado en la base de datos.'
            });
        }
    } catch (error) {
        console.error('Error en /api/contact:', error);
        res.status(500).json({ error: 'Error del servidor al procesar el mensaje' });
    }
});

// ---- ADMIN MIDDLEWARE ----
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.sendStatus(403);
    next();
};

// ---- ADMIN ENDPOINTS ----

app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [[users]] = await pool.execute('SELECT COUNT(*) as count FROM users');
        const [[orders]] = await pool.execute('SELECT COUNT(*) as count FROM orders');
        const [[revenue]] = await pool.execute('SELECT COALESCE(SUM(total_price), 0) as total FROM orders');
        const [[items]] = await pool.execute('SELECT COUNT(*) as count FROM items');
        const [[messages]] = await pool.execute('SELECT COUNT(*) as count FROM messages');

        const [itemsByType] = await pool.execute('SELECT type, COUNT(*) as count FROM items GROUP BY type');
        const [recentOrders] = await pool.execute(`
            SELECT o.*, u.name as user_name, u.email as user_email
            FROM orders o JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC LIMIT 5
        `);
        const [recentUsers] = await pool.execute('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5');

        res.json({
            totals: { users: users.count, orders: orders.count, revenue: parseFloat(revenue.total), items: items.count, messages: messages.count },
            itemsByType,
            recentOrders,
            recentUsers
        });
    } catch (error) {
        console.error('Error en /api/admin/stats:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [users] = await pool.execute('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
        res.json(users);
    } catch (error) {
        console.error('Error en /api/admin/users:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
        await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: 'Usuario eliminado' });
    } catch (error) {
        console.error('Error en DELETE /api/admin/users:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [orders] = await pool.execute(`
            SELECT o.*, u.name as user_name, u.email as user_email
            FROM orders o JOIN users u ON o.user_id = u.id
            ORDER BY o.created_at DESC
        `);
        for (const order of orders) {
            const [items] = await pool.execute(`
                SELECT oi.*, i.name, i.type, i.image_url
                FROM order_items oi JOIN items i ON oi.item_id = i.id
                WHERE oi.order_id = ?
            `, [order.id]);
            order.items = items;
        }
        res.json(orders);
    } catch (error) {
        console.error('Error en /api/admin/orders:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/messages', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [messages] = await pool.execute('SELECT * FROM messages ORDER BY created_at DESC');
        res.json(messages);
    } catch (error) {
        console.error('Error en /api/admin/messages:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/admin/items', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [items] = await pool.execute('SELECT * FROM items ORDER BY created_at DESC');
        res.json(await attachImagesToItems(items));
    } catch (error) {
        console.error('Error en /api/admin/items:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/admin/messages/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await pool.execute('DELETE FROM messages WHERE id = ?', [req.params.id]);
        res.json({ message: 'Mensaje eliminado' });
    } catch (error) {
        console.error('Error en DELETE /api/admin/messages:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/admin/items', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { type, name, description, price, image_url } = req.body;
        if (!type || !name || !price) return res.status(400).json({ error: 'Tipo, nombre y precio son obligatorios' });
        const [result] = await pool.execute(
            'INSERT INTO items (type, name, description, price, image_url) VALUES (?, ?, ?, ?, ?)',
            [type, name, description || '', price, image_url || '']
        );
        res.status(201).json({ message: 'Item creado', itemId: result.insertId });
    } catch (error) {
        console.error('Error en POST /api/admin/items:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/admin/items/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { type, name, description, price, image_url } = req.body;
        await pool.execute(
            'UPDATE items SET type = ?, name = ?, description = ?, price = ?, image_url = ? WHERE id = ?',
            [type, name, description, price, image_url, req.params.id]
        );
        res.json({ message: 'Item actualizado' });
    } catch (error) {
        console.error('Error en PUT /api/admin/items:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.patch('/api/admin/items/:id/availability', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { is_available } = req.body;
        await pool.execute(
            'UPDATE items SET is_available = ? WHERE id = ?',
            [Boolean(is_available), req.params.id]
        );
        res.json({ message: Boolean(is_available) ? 'Vehículo disponible' : 'Vehículo no disponible' });
    } catch (error) {
        console.error('Error en PATCH /api/admin/items/:id/availability:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/admin/items/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await pool.execute('DELETE FROM items WHERE id = ?', [req.params.id]);
        res.json({ message: 'Item eliminado' });
    } catch (error) {
        console.error('Error en DELETE /api/admin/items:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 5000;
Promise.all([ensureItemsAvailabilityColumn(), ensureItemImagesTable()]).finally(() => {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});
