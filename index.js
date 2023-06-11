const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eiraya6.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const classesCollection = client.db('sportsAcademy').collection('classes');
        const bookingClassCollection = client.db('sportsAcademy').collection('bookingClass');
        const usersCollection = client.db('sportsAcademy').collection('users');




        // classes relevant apis
        app.get('/classes', async (req, res) => {
            const query = {};
            const options = {
                sort: { "enrolled_student": -1 }
            }
            const result = await classesCollection.find(query, options).toArray();
            res.send(result);
        })

        // student: My Selected Classes
        app.get('/bookingClass', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([])
            }
            const query = { email: email }
            const result = await bookingClassCollection.find(query).toArray();
            res.send(result)
        })

        app.post('/bookingClass', async (req, res) => {
            const classes = req.body;
            console.log(classes);
            const result = await bookingClassCollection.insertOne(classes);
            res.send(result)
        })

        // users relevant api
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray()
            res.send(result)
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result)
        })




        // booking delete specific id
        app.delete('/bookingClass/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingClassCollection.deleteOne(query);
            res.send(result)
        })











        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('final assignment project is running')
})

app.listen(port, () => {
    console.log(`Final Assignment Project server is running on port ${port}`);
})