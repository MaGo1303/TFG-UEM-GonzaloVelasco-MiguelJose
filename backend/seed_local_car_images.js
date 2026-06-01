require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const publicImgDir = path.join(__dirname, '..', 'frontend', 'public', 'img');
const imageExtensions = new Set(['.avif', '.jpeg', '.jpg', '.png', '.webp']);

const localCarImages = {
    'Ferrari 488 GTB': [
        '/img/ferrari-488.jpg',
        '/img/ferrari-488-2.jpg',
        '/img/ferrari 488 gtb-3.jpg',
    ],
    'Ferrari F8 Tributo': [
        '/img/Ferrari F8 Tributo 2.jpg',
        '/img/Ferrari F8 Tributo-2.jpg',
        '/img/Ferrari F8 Tributo-3.jpg',
    ],
    'Ferrari Roma': [
        '/img/Ferrari Roma-1.jpg',
        '/img/Ferrari Roma-2.jpg',
        '/img/Ferrari Roma-3.jpg',
    ],
    'Ferrari SF90 Stradale': [
        '/img/Ferrari SF90 Stradale-1.jpeg',
        '/img/Ferrari SF90 Stradale-2.jpg',
        '/img/Ferrari SF90 Stradale-3.jpg',
    ],
    'Lamborghini Aventador SVJ': [
        '/img/Lamborghini Aventador SVJ-1.jpg',
        '/img/Lamborghini Aventador SVJ-2.jpg',
        '/img/Lamborghini Aventador SVJ-3.jpg',
    ],
    'Lamborghini Urus': [
        '/img/Lamborghini Urus-1.jpg',
        '/img/Lamborghini Urus-2.jpg',
        '/img/Lamborghini Urus-3.png',
    ],
    'Rolls-Royce Ghost': [
        '/img/Rolls-Royce Ghost-1.jpg',
        '/img/Rolls-Royce Ghost-2.jpg',
        '/img/Rolls-Royce Ghost-3.jpg',
    ],
    'Rolls-Royce Phantom': [
        '/img/Rolls-Royce Phantom-1.jpg',
        '/img/Rolls-Royce Phantom-2.jpg',
        '/img/Rolls-Royce Phantom-3.jpg',
    ],
    'Bentley Continental GT': [
        '/img/Bentley Continental GT-1.png',
        '/img/Bentley Continental GT-2.png',
        '/img/Bentley Continental GT-3.png',
    ],
    'Bentley Flying Spur': [
        '/img/Bentley Flying Spur-1.jpg',
        '/img/Bentley Flying Spur-2.jpeg',
        '/img/Bentley Flying Spur-3.jpeg',
    ],
    'Porsche 911 Turbo S': [
        '/img/Porsche 911 Turbo S-1.jpg',
        '/img/Porsche 911 Turbo S-2.jpg',
        '/img/Porsche 911 Turbo S-3.jpg',
    ],
    'Porsche Taycan Turbo S': [
        '/img/Porsche Taycan Turbo S-1.jpg',
        '/img/Porsche Taycan Turbo S-2.jpg',
        '/img/Porsche Taycan Turbo S-3.jpg',
    ],
    'Mercedes-AMG G63': [
        '/img/Mercedes-AMG G63-1.jpg',
        '/img/Mercedes-AMG G63-2.jpg',
        '/img/Mercedes-AMG G63-3.jpg',
    ],
    'Mercedes-Maybach S680': [
        'https://upload.wikimedia.org/wikipedia/commons/a/a4/Czeladz_Mercedes_Maybach_S680_2.jpg',
        'https://upload.wikimedia.org/wikipedia/commons/8/8c/Czeladz_Mercedes_Maybach_S680_1.jpg',
        'https://commons.wikimedia.org/wiki/Special:Redirect/file/Mercedes-Maybach_S_680_(55083988367).jpg',
    ],
};

const trimToThreeImages = [
    'Lamborghini Huracán EVO',
    'Rolls-Royce Cullinan',
];

const trimToTwoImages = [
    'Bentley Bentayga',
];

function findLocalNumberedImages(itemName) {
    if (!fs.existsSync(publicImgDir)) return [];

    const escapedName = itemName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const imagePattern = new RegExp(`^${escapedName}-(\\d+)\\.(avif|jpe?g|png|webp)$`, 'i');

    return fs.readdirSync(publicImgDir)
        .map(fileName => {
            const match = fileName.match(imagePattern);
            if (!match) return null;

            const extension = path.extname(fileName).toLowerCase();
            if (!imageExtensions.has(extension)) return null;

            return {
                position: Number(match[1]),
                imageUrl: `/img/${fileName}`,
            };
        })
        .filter(Boolean)
        .sort((left, right) => left.position - right.position || left.imageUrl.localeCompare(right.imageUrl))
        .map(image => image.imageUrl);
}

async function seedLocalCarImages() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'royalrent',
    });

    try {
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS item_images (
                id INT AUTO_INCREMENT PRIMARY KEY,
                item_id INT NOT NULL,
                image_url TEXT NOT NULL,
                position INT DEFAULT 0,
                FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
            )
        `);
        await connection.execute('ALTER TABLE item_images MODIFY image_url TEXT NOT NULL');

        const [allItems] = await connection.execute('SELECT id, name FROM items ORDER BY id ASC');
        const autoLocalImages = allItems.reduce((acc, item) => {
            if (localCarImages[item.name]) return acc;

            const images = findLocalNumberedImages(item.name);
            if (images.length > 0) {
                acc[item.name] = images;
            }

            return acc;
        }, {});

        const imagesByVehicle = {
            ...autoLocalImages,
            ...localCarImages,
        };

        for (const [name, images] of Object.entries(imagesByVehicle)) {
            const [items] = await connection.execute(
                'SELECT id FROM items WHERE name = ? LIMIT 1',
                [name]
            );

            if (!items.length) {
                console.log(`SKIP ${name}: vehicle not found`);
                continue;
            }

            const itemId = items[0].id;
            await connection.execute('DELETE FROM item_images WHERE item_id = ?', [itemId]);

            for (const [position, imageUrl] of images.entries()) {
                await connection.execute(
                    'INSERT INTO item_images (item_id, image_url, position) VALUES (?, ?, ?)',
                    [itemId, imageUrl, position]
                );
            }

            console.log(`OK ${name}: saved ${images.length} local images`);
        }

        for (const name of trimToThreeImages) {
            const [items] = await connection.execute(
                'SELECT id FROM items WHERE name = ? LIMIT 1',
                [name]
            );

            if (!items.length) {
                console.log(`SKIP ${name}: vehicle not found`);
                continue;
            }

            await connection.execute(
                'DELETE FROM item_images WHERE item_id = ? AND position >= 3',
                [items[0].id]
            );

            console.log(`OK ${name}: removed images after the third one`);
        }

        for (const name of trimToTwoImages) {
            const [items] = await connection.execute(
                'SELECT id FROM items WHERE name = ? LIMIT 1',
                [name]
            );

            if (!items.length) {
                console.log(`SKIP ${name}: vehicle not found`);
                continue;
            }

            await connection.execute(
                'DELETE FROM item_images WHERE item_id = ? AND position >= 2',
                [items[0].id]
            );

            console.log(`OK ${name}: removed images after the second one`);
        }

        console.log('Local car image seeding completed.');
    } finally {
        await connection.end();
    }
}

seedLocalCarImages().catch(error => {
    console.error('Local car image seeding failed:', error);
    process.exitCode = 1;
});
