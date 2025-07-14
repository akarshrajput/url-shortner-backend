require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const validUrl = require("valid-url");
const { nanoid } = require("nanoid");
const geoip = require("geoip-lite");
const dayjs = require("dayjs");
const { loggerMiddleware, log } = require("./loggerMiddleware");
const connectDB = require("./db");
const ShortUrl = require("./models/ShortUrl");

const app = express();
const PORT = process.env.PORT || 4000;
const HOSTNAME = process.env.HOSTNAME || `http://localhost:${PORT}`;

app.use(cors());
app.use(bodyParser.json());
app.use(loggerMiddleware);

connectDB();

function isValidShortcode(code) {
  return /^[a-zA-Z0-9]{4,10}$/.test(code);
}

async function generateUniqueShortcode() {
  let code;
  let exists = true;
  while (exists) {
    code = nanoid(6);
    exists = await ShortUrl.exists({ shortcode: code });
  }
  return code;
}

app.post("/shorturls", async (req, res) => {
  try {
    const { url, validity, shortcode } = req.body;

    if (!url || !validUrl.isWebUri(url)) {
      return res.status(400).json({ error: "Invalid or missing URL" });
    }

    let validMinutes = 30;
    if (validity !== undefined) {
      if (!Number.isInteger(validity) || validity <= 0) {
        return res
          .status(400)
          .json({ error: "Validity must be a positive integer (minutes)" });
      }
      validMinutes = validity;
    }

    let code = shortcode;
    if (code !== undefined) {
      if (typeof code !== "string" || !isValidShortcode(code)) {
        return res.status(400).json({
          error: "Invalid shortcode format. Must be alphanumeric 4-10 chars.",
        });
      }
      const exists = await ShortUrl.exists({ shortcode: code });
      if (exists) {
        return res.status(409).json({ error: "Shortcode already in use" });
      }
    } else {
      code = await generateUniqueShortcode();
    }

    const createdAt = new Date();
    const expiry = new Date(createdAt.getTime() + validMinutes * 60000);

    const shortUrl = new ShortUrl({
      originalUrl: url,
      shortcode: code,
      createdAt,
      expiry,
      clicks: [],
    });

    await shortUrl.save();

    log(
      `Short URL created: ${code} -> ${url}, expires at ${expiry.toISOString()}`
    );

    return res.status(201).json({
      shortLink: `${HOSTNAME}/${code}`,
      expiry: expiry.toISOString(),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/:shortcode", async (req, res) => {
  try {
    const code = req.params.shortcode;
    const record = await ShortUrl.findOne({ shortcode: code });

    if (!record) {
      return res.status(404).json({ error: "Shortcode not found" });
    }

    const now = new Date();
    if (now > record.expiry) {
      return res.status(410).json({ error: "Short URL has expired" });
    }

    const referrer = req.get("Referrer") || req.get("Referer") || "direct";
    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const geo = geoip.lookup(ip) || {};
    const location = geo.country || "unknown";

    record.clicks.push({
      timestamp: now,
      referrer,
      location,
    });

    await record.save();

    log(
      `Redirecting shortcode ${code} to ${record.originalUrl} (click from ${location}, referrer: ${referrer})`
    );

    return res.redirect(record.originalUrl);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/shorturls/:shortcode", async (req, res) => {
  try {
    const code = req.params.shortcode;
    const record = await ShortUrl.findOne({ shortcode: code });

    if (!record) {
      return res.status(404).json({ error: "Shortcode not found" });
    }

    res.json({
      shortcode: code,
      originalUrl: record.originalUrl,
      createdAt: record.createdAt.toISOString(),
      expiry: record.expiry.toISOString(),
      totalClicks: record.clicks.length,
      clicks: record.clicks.map((c) => ({
        timestamp: c.timestamp.toISOString(),
        referrer: c.referrer,
        location: c.location,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`URL Shortener microservice running at ${HOSTNAME}`);
});
