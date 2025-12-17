const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000
const cors =require('cors')
// middleware
app.use(express.json())
app.use(cors())


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
    const bookCollection =database.collection('books')

    // books api
    app.post('/books', async (req, res)=>{
      const book =req.body;
      book.createAT = new Date()
      const result =await bookCollection.insertOne(book)
      res.send(result)
    })
    // get all books
     app.get('/books', async(req, res)=>{
      const result =await bookCollection.find().toArray()
      res.send(result)
     })
    // get details book
   app.get('/book-details/:id', async(req, res)=>{
    const id =req.params.id;
    const query ={
      _id : new ObjectId(id)
    }
    const result =await bookCollection.findOne(query)
    res.send(result)
   })
  //  latest book
   app.get("/latest_books", async (req, res) => {
     const result = await bookCollection
       .find()
       .sort({ createdAt: -1 })
       .limit(6)
       .toArray();

     res.send(result);
   });

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
