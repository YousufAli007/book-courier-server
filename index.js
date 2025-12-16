const express = require("express");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000
const cors =require('cors')
// middleware
app.use(express.json())
app.use(cors())
app.get("/", (req, res) => {
  res.send("welcome to book courier");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
