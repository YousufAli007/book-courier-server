const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000
const cors =require('cors');
const e = require("express");
// middleware
app.use(express.json())
app.use(cors())

const admin = require("firebase-admin");

const serviceAccount = require("./book-courier-firebase-admin.json");

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
    await client.connect();

    const database =client.db('book_courier')
    const bookCollection =database.collection('books');
    const orderCollection =database.collection('orders')
    const userCollection =database.collection('users')
    // user api
    app.post ('/users', async(req, res)=>{
      const users =req.body;
      users.role ="user";
      users.createAT =new Date()
      const email =users.email;
      const userExists =await userCollection.findOne({email});
      if(userExists){
        return res.send({message:'user Exists'})
      }
      const result =await userCollection.insertOne(users)
      res.send(result)
    })

    // books api
    app.post('/books', async (req, res)=>{
      const book =req.body;
      book.createAT = new Date()
      const result =await bookCollection.insertOne(book)
      res.send(result)
    })
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
   app.get('/book-details/:id', async(req, res)=>{
    const id =req.params.id;
    const query ={
      _id : new ObjectId(id)
    }
    const result =await bookCollection.findOne(query)
    res.send(result)
   })
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


  //  latest book
   app.get("/latest_books", async (req, res) => {
     const result = await bookCollection
       .find()
       .sort({ createdAt: -1 })
       .limit(6)
       .toArray();

     res.send(result);
   });


  //  orders api
   app.get('/orders',verifyFBToken, async(req, res)=>{
    const query ={}
    const {email}=req.query;
    if(email){
      query.buyerEmail =email;
      if(email !== req.decoded_email){
        return res.status(403).send({message:'forbidden access'})
      }
    }
    const option = { sort: { createAT:-1} };
    const cursor =orderCollection.find(query,option)
    const result =await cursor.toArray()
    res.send(result)
   })

   app.post('/orders',async(req, res)=>{
    const ordersInfo =req.body;
    ordersInfo.createAT =new Date();
    ordersInfo.paymentStatus='pending';
    const result =await orderCollection.insertOne(ordersInfo)
    res.send(result)
   })
   app.delete('/order/:id', async(req, res)=>{
      const id =req.params.id;
      const query ={ _id: new ObjectId(id)}
      const result =await orderCollection.deleteOne(query)
      res.send(result)
   })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
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
