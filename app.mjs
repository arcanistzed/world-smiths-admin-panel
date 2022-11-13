import express, { Router } from "express";
import ejs from "ejs";
import { exec } from "child_process";
import fetch from "node-fetch";
import fs from "fs-extra";

const app = express();
const router = Router();

app.set("view engine", "html");
app.engine("html", ejs.renderFile);

app.use("/admin", router);
app.use("/admin/static", express.static("public"));

router.get("/", (req, res) => {
	return res.render("index", {
		title: "Admin Panel",
		views: ["restart", "choose"],
	});
});

router.use(async (req, res, next) => {
	if (req.url.includes("static")) return next();
	const status = await (await fetch(`https://${req.headers.host}/api/status`)).json();
	try {
		if (status.active && status.users > 0) {
			return res.status(400).render("error", {
				title: "Error",
				error: "Cannot modify server while users are connected",
			});
		}
		return next();
	} catch (e) {
		return res.status(500).render("error", { title: "Error", error: "Server is not responding" });
	}
});

router.get("/restart", async (req, res) => {
	exec("pm2 restart foundry", (error, stdout, stderr) => {
		if (error || stderr) {
			console.log(`Error: ${error.message} ${stderr}`);
			return res.send(`Error: ${error.message} ${stderr}`);
		}
		return res.render("restart", { title: "Restarted server" });
	});
});

router.get("/choose", async (req, res) => {
	if (req.query.world) {
		// If a world is chosen, update the config file and restart
		const config = await fs.readJson("../../Config/options.json");
		config.world = req.query.world;
		await fs.writeJson("../../Config/options.json", config);
		return res.redirect("/admin/restart");
	} else {
		// Send a list of worlds to choose from
		const worlds = fs
			.readdirSync("../worlds", { withFileTypes: true })
			.filter(dirent => dirent.isDirectory())
			.map(dirent => dirent.name);
		return res.render("choose", { title: "Choose world", worlds });
	}
});

app.use((req, res) => {
	return res.status(404).render("error", { title: "Error", error: "Not Found" });
});

app.listen(3000, () => {
	console.log("Server started on port 3000");
});
