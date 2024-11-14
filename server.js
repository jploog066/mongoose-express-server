const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config()

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

const connections = {};

const models = {};

// const bankUserSchema = new mongoose.Schema({});

const getConnection = async (dbName) => {
    console.log(`getConnection called with ${dbName}`);
    if (!connections[dbName]) {
        connections[dbName] = await mongoose.createConnection(process.env.MONGO_URI, { dbName: dbName, autoIndex: false });
        // Await the 'open' event to ensure the connection is established
        await new Promise((resolve, reject) => {
            connections[dbName].once("open", resolve);
            connections[dbName].once("error", reject);
        });
        console.log("a new database has been created for dbName");
    } else {
        console.log("reusing existing connection for dbName");
    }
    return connections[dbName]
}

const getModel = async (dbName, collectionName) => {
    const Model = modelMapping[collectionName];
    if (!Model) {
        // Use a dynamic schema with autoIndex disabled if no model is found
        const dynamicSchema = new mongoose.Schema(
            {},
            { strict: false, autoIndex: false }
        );
        models[modelKey] = connection.model(
            collectionName,
            dynamicSchema,
            collectionName
        );
        console.log(`Created dynamic model for collection: ${collectionName}`);
    } else {
        // Use the predefined model's schema with autoIndex already disabled
        models[modelKey] = connection.model(
            Model.modelName,
            Model.schema,
            collectionName // Use exact collection name from request
        );
        console.log("Created new model for collection:", collectionName);
    }
    return models[modelKey];
};

app.get('/find/:database/:collection', async (req, res) => {
    try {
        const { database, collection } = req.params;
        const model = await getModel(database, collection);
        const documents = await model.find({});
        console.log(`query executed, document count is: ${documents.length}`);
        return res.status(200).json(documents);
    } catch (err) {
        console.error("error in GET route: ", err);
        return res.status(500).json({ error: err.message });
    }
});

// DELETE route to delete a specific collection in a database
app.delete("/delete-collection/:database/:collection", async (req, res) => {
    try {
        const { database, collection } = req.params;
        const connection = await getConnection(database); // Establish or retrieve the connection
        // Check if the collection exists
        const collections = await connection.db
            .listCollections({ name: collection })
            .toArray();
        const collectionExists = collections.length > 0;
        if (!collectionExists) {
            return res
                .status(404)
                .json({
                    error: `Collection '${collection}' does not exist in database '${database}'.`,
                });
        }
        // Drop the collection
        await connection.db.dropCollection(collection);
        console.log(
            `Collection '${collection}' deleted from database '${database}'.`
        );
        // Remove the model associated with this collection
        const modelKey = `${database}-${collection}`;
        delete models[modelKey];
        res.status(200).json({
            message: `Collection '${collection}' has been successfully deleted from database '${database}`
        });
    } catch (err) {
        console.error("Error deleting collection:", err);
        res
            .status(500)
            .json({ error: "An error occurred while deleting the collection." });
    }
});

async function startServer() {
    try {
        app.listen(PORT, () => {
            console.log(`the server is running on ${PORT}`);
        })
    } catch (err) {
        console.error('Error starting server: ', err);
        process.exit(1);
    }
}

startServer()