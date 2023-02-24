import fs from 'fs';
import admin from 'firebase-admin';
import express from 'express';
import { db, connectToDb} from './db.js';

const credentials = JSON.parse(
    fs.readFileSync('./credentials.json')
);
admin.initializeApp({
    credential: admin.credential.cert(credentials),
});

const app = express();
app.use(express.json());

app.use(async (req, res, next) => {
    const { authtoken } = req.headers;

    if (authtoken) {
        try {
            req.user = await admin.auth().verifyIdToken(authtoken);
        } catch (e) {
            return res.sendStatus(400);
        }
    }

    req.user = req.user || {};

    next();
});

// app.post('/hello', (req, res) => {
//     res.send(`Hi there ${req.body.name}!`);
// });

// app.get('/hello/:name', (req, res) => {
//     const { name } = req.params;
//     res.send(`Hello ${name}!!`);
// });

app.get('/api/articles/:name', async (req, res) => {
    const { name } = req.params;
    const { uid } = req.user;

    const article = await db.collection('articles').findOne({ name });

    if (article) {
        const upvoteIds = article.upvoteIds || [];
        article.canUpvote = uid && !upvoteIds.includes(uid);
        res.json(article);
    } else {
        res.status(404).send(`Article ${name} doesn't exist`);
    }
});

app.use((req, res, next) => {
    if (req.user) {
        next();
    } else {
        res.sendStatus(401);
    }
})

app.put('/api/articles/:name/upvote', async (req, res) => {
    const { name } = req.params;

    const article = await db.collection('articles').findOne({ name });

    if (article) {
        const upvoteIds = article.upvoteIds || [];
        const canUpvote = uid && !upvoteIds.includes(uid);

        if (canUpvote) {
            await db.collection('articles').updateOne({ name }, {
                $inc: { upvotes: 1},
                $push: { upvoteIds: uid },
            });        
        }

        res.json(article);
    } else {
        res.status(404).send(`Article ${name} doesn't exist`);
    }
});

app.post('/api/articles/:name/comments', async (req, res) => {
    const { name } = req.params;
    const { text } = req.body;
    const { email } = req.user;

    await db.collection('articles').updateOne({ name }, {
        $push: { comments: { postedBy: email, text } },
    });

    const article = await db.collection('articles').findOne({ name });
    if (article) {
        // article.comments.push({ postedBy, text });
        // res.send(article.comments);
        res.json(article);
    } else {
        res.status(404).send(`Article ${name} doesn't exist`);
    }
});

connectToDb(() => {
    console.log('Successfully connected to database');
    const port = 8000;
    app.listen(port, () => {
        console.log(`Server is listening on ${port}`);
    });
});
