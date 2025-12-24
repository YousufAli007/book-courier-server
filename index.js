const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000
const cors =require('cors');
const e = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
// middleware
app.use(express.json())
app.use(cors())

const admin = require("firebase-admin");

// index.js
const decoded = Buffer.from(
  process.env.FIREBASE_SERVICE_KEY,
  "base64"
).toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const verifyFBToken = async(req,res, next)=>{
 
  const token =req.headers.authorization;
  if(!token){
    return res.status(401).send({message: 'unauthorized access'})
  }
  try{
    const idToken =token.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(idToken)
    // console.log('decoded in the token',decoded )
    req.decoded_email =decoded.email
     next();
  }
  catch(erro){
    return res.status(401).send({message: 'unauthorized access'})
  }
 
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.cydeyqc.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const database = client.db("book_courier");
    const bookCollection = database.collection("books");
    const orderCollection = database.collection("orders");
    const userCollection = database.collection("users");
    const serviceCollection = database.collection("service");
    const wishlistCollection = database.collection("wishlist");
     const reviewRatinCollecton = database.collection("review_rating");
     const paymentCollection =database.collection('payments')
    //  
    app.get("/payments", async (req, res) => {
      const email = req.query.email;

      let query = {};
      if (email) {
        query = { email: email };
      }

      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    //  payment relate api
    app.post("/create-checkout-session", async (req, res) => {
      try {
        const paymentInfo = req.body;
        const amount = parseInt(paymentInfo.cost) * 100;

        const session = await stripe.checkout.sessions.create({
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: amount,
                product_data: {
                  name: paymentInfo.bookName,
                },
              },
              quantity: 1,
            },
          ],
          mode: "payment",
          metadata: {
            parcelId: paymentInfo.parcelId,
            email: paymentInfo.email,
          },
          success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,
        });

        res.send({ url: session.url });
      } catch (error) {
        console.error(error);
        res.status(400).send({ error: error.message });
      }
    });
    app.patch('/payment-succes', async(req, res)=>{
      const sessionId =req.query.session_id;
       const session = await stripe.checkout.sessions.retrieve(sessionId)
       console.log('session retrieve',session)
        const transactonId = session.payment_intent;
        const query = { transactonId: transactonId };
        const paymentExist = await paymentCollection.findOne(query);
      if (paymentExist) {
        return res.send({ message: "already existst" });
      }

       if (session.payment_status === 'paid'){
        const id = session.metadata.parcelId;
        const query ={_id:new ObjectId(id)}
        const update = {
          $set: {
            paymentStatus:'paid',

          },
        };
        const result =await orderCollection.updateOne(query,update)

        const payment = {
          amount: session.amount_total / 100,
          parcelId: session.metadata.parcelId,
          transactionId: session.payment_intent,
          paymentStatus: session.payment_status,
          email:session.metadata.email,
          createAT: new Date(),
        };
        if (session.payment_status === "paid") {
          const resultPayment = await paymentCollection.insertOne(payment);
          res.send({
            success: true,
            modifyParcel: result,
            paymentInfo: resultPayment,
          });
        }
      
       } 
       
         res.send({ success: false });
      
    })

    //  review api
     app.post('/review', async(req, res)=>{
      const review =req.body;
      review.createAT = new Date()
      const result =await reviewRatinCollecton.insertOne(review)
      res.send(result)
     })
     app.get("/reviews/:bookId", async (req, res) => {
       const bookId = req.params.bookId;

       const result = await reviewRatinCollecton
         .find({ bookId: bookId })
         .sort({ createAT: -1 }) // latest first
         .limit(4) // only 4 reviews
         .toArray();

       res.send(result);
     });
    // add wishlist
    app.post("/wishlist", async (req, res) => {
      try {
        const item = req.body;

        // 🔍 check same bookId already exists
        const exists = await wishlistCollection.findOne({
          bookId: item.bookId,
          // buyerEmail: item.buyerEmail
        });

        if (exists) {
          return res.send({ message: "Already added to wishlist" });
        }

        const result = await wishlistCollection.insertOne(item);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to add wishlist" });
      }
    });

    app.get("/wishlist", async (req, res) => {
      const result = await wishlistCollection.find().toArray();
      res.send(result);
    });

    // service center
    app.post("/service", async (req, res) => {
      const query = req.body;
      const result = await serviceCollection.insertOne(query);
      res.send(result);
    });
    app.get("/service", async (req, res) => {
      const result = await serviceCollection.find().toArray();
      res.send(result);
    });

    // user api
    app.post("/users", async (req, res) => {
      const users = req.body;
      users.role = "user";
      users.createAT = new Date();
      const email = users.email;
      const userExists = await userCollection.findOne({ email });
      if (userExists) {
        return res.send({ message: "user Exists" });
      }
      const result = await userCollection.insertOne(users);
      res.send(result);
    });
    // get all users
    app.get("/users", verifyFBToken, async (req, res) => {
      const { email } = req.query;

      const query = email ? { email } : {};

      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/users/admin/:id", verifyFBToken, async (req, res) => {
      const id = req.params.id;

      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: "admin" } }
      );

      res.send(result);
    });
    app.patch("/users/librarian/:id", verifyFBToken, async (req, res) => {
      const id = req.params.id;

      const result = await userCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: "librarian" } }
      );

      res.send(result);
    });

    // books api
    app.post("/books", async (req, res) => {
      const book = req.body;
      book.createAT = new Date();
      const result = await bookCollection.insertOne(book);
      res.send(result);
    });
    // get all books
    app.get("/books", async (req, res) => {
      const { email } = req.query;
      const query = {};

      if (email) {
        query.sellerEmail = email;
      }

      const result = await bookCollection.find(query).toArray();
      res.send(result);
    });
    // get details book
    app.get("/book-details/:id", async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id),
      };
      const result = await bookCollection.findOne(query);
      res.send(result);
    });
    //  update book Staus
    app.patch("/books/status/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      const result = await bookCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status } }
      );

      res.send(result);
    });
    app.get("/books/:id", async (req, res) => {
      const id = req.params.id;

      const result = await bookCollection.findOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    app.put("/books/:id", async (req, res) => {
      const id = req.params.id;
      const updatedBook = req.body;

      const result = await bookCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            bookName: updatedBook.bookName,
            bookImageUrl: updatedBook.bookImageUrl,
            author: updatedBook.author,
            price: updatedBook.price,
            status: updatedBook.status,
            updatedAt: new Date(),
          },
        }
      );

      res.send(result);
    });
    // MANGAE BOOK
    // DELETE all orders by bookId
    app.delete("/orders-by-book/:bookId", async (req, res) => {
      const { bookId } = req.params;
      try {
        const result = await orderCollection.deleteMany({ bookId: bookId });
        res.send({ deletedCount: result.deletedCount });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ message: "Failed to delete orders for this book" });
      }
    });

    // DELETE a book by id
    app.delete("/books/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await bookCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to delete the book" });
      }
    });

    //  latest book
    app.get("/latest_books", async (req, res) => {
      const result = await bookCollection
        .find()
        .sort({ createAT: -1 })
        .limit(6)
        .toArray();

      res.send(result);
    });

    //  orders api
    app.get("/orders", verifyFBToken, async (req, res) => {
      const query = {};
      const { email } = req.query;
      if (email) {
        query.buyerEmail = email;
        if (email !== req.decoded_email) {
          return res.status(403).send({ message: "forbidden access" });
        }
      }
      const option = { sort: { createAT: -1 } };
      const cursor = orderCollection.find(query, option);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/orders", verifyFBToken, async (req, res) => {
      const order = req.body;

      order.createAT = new Date();
      order.paymentStatus = "pending";
      order.status = "pending";

      const result = await orderCollection.insertOne(order);
      res.send(result);
    });
    app.patch("/orders/status/:id", verifyFBToken, async (req, res) => {
      const { status } = req.body;

      const result = await orderCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status } }
      );

      res.send(result);
    });
    app.patch("/orders/cancel/:id", verifyFBToken, async (req, res) => {
      const result = await orderCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: "cancelled" } }
      );

      res.send(result);
    });

    app.delete("/order/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    });
    app.get("/seller-orders", verifyFBToken, async (req, res) => {
      const { email } = req.query;

      if (email !== req.decoded_email) {
        return res.status(403).send({ message: "forbidden" });
      }

      const result = await orderCollection
        .find({ sellerEmail: email })
        .sort({ createAT: -1 })
        .toArray();

      res.send(result);
    });

    app.get('/order/:id',async (req,res)=>{
      const id =req.params.id;
      const query ={_id: new ObjectId(id)}
      const result =await orderCollection.findOne(query)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
  res.send("welcome to book courier");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
