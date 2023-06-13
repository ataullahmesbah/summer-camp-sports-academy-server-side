const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }

    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}




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
        const paymentCollection = client.db('sportsAcademy').collection('payments');



        // post jwt
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            })
            res.send({ token })
        })

        // verifyJWT before using verifyAdmin

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        // verifyJWT before using verifyInstructor

        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }





        // app.get('/classes', async (req, res) => {
        //     const query = {};
        //     // if (req.query?.email) {
        //     //     query = { email: req.query.email }
        //     // }
        //     const options = {
        //         sort: { "enrolled_student": -1 }
        //     }
        //     const result = await classesCollection.find(query, options).toArray();
        //     res.send(result);
        // })



        // classes relevant apis
        app.get('/classes', async (req, res) => {
            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email };
            }
            const options = {
                sort: { "enrolled_student": -1 }
            };
            const result = await classesCollection.find(query, options).toArray();
            res.send(result);
        });

        // // instructor specific add class show query data
        app.get('/classes', verifyJWT, verifyAdmin, verifyInstructor, async (req, res) => {
            const query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            }

            const result = await classesCollection.find(query).toArray();
            res.send(result);
        })

        // instructor new class add
        app.post('/classes', verifyJWT, verifyInstructor, async (req, res) => {
            const newClasses = req.body;
            const result = await classesCollection.insertOne(newClasses)
            res.send(result)
        })

        // classes delete specific id
        app.delete('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await classesCollection.deleteOne(query);
            res.send(result)
        })

        // student: My Selected Classes
        app.get('/bookingClass', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([])
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
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
            try {
                const user = req.body;
                const query = { email: user.email };
                const existingUser = await usersCollection.findOne(query);
                if (existingUser) {
                    return res.send({ message: 'User already exists' });
                }
                const saveUser = { name: user.name, email: user.email, img: user.img };

                const result = await usersCollection.insertOne(saveUser);
                res.send(result);
            } catch (error) {
                res.status(500).send({ error: 'Failed to create user' });
            }
        });



        // users admin role
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result)
        })

        // check admin
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result)
        })

        // Check if user is an instructor
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ instructor: false });
                return;
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' };
            res.send(result);
        });


        // users instructor role
        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                }
            };

            try {
                const result = await usersCollection.updateOne(filter, updateDoc);
                res.send(result);
            } catch (error) {
                res.status(500).send('Error updating user role to instructor');
            }
        });




        // booking delete specific id
        app.delete('/bookingClass/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingClassCollection.deleteOne(query);
            res.send(result)
        })


        // create payment method
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        // payment related api..
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);

            const query = { _id: { $in: payment.bookingClasses.map(id => new ObjectId(id)) } }
            const deleteResult = await bookingClassCollection.deleteMany(query)

            res.send({ insertResult, deleteResult });
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