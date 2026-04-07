# ☁️ GDGoC UM Cloud Workshop: Dino Grand Prix 🦖🏎️

Welcome to the GDGoC UM Cloud Workshop! Today, we are leveling up to **Serverless Architecture**. 

You are going to deploy your very own real-time multiplayer game to the internet using **Google Cloud Run**. By the end of this guide, you will have a live game server capable of hosting dozens of players simultaneously with zero lag!

---

## 🛠️ Prerequisites
Because we are using Google's cloud-native tools, you do not need to install anything on your laptop! All you need is:
* A web browser
* A Google Cloud Account (with Free Tier/Credits)

---

## 💻 Part 1: Boot Up the Cloud Shell
Instead of downloading heavy SDKs, we will use a temporary virtual machine provided by Google.

1. Go to your [Google Cloud Console](https://console.cloud.google.com/).
2. In the top-left corner, choose the project linked to free credits account.
3. In the top right corner (next to your profile picture), click the **Activate Cloud Shell** icon (it looks like a `>_` terminal).
4. Wait a few seconds for your terminal to boot up at the bottom of the screen.

---

## 🏃 Part 2: Get the Code
Let's pull the game engine from GitHub directly into our Cloud Shell environment.

In your Cloud Shell terminal, copy and paste this command:
```bash
git clone [https://github.com/JunBin05/dino-grand-prix.git](https://github.com/JunBin05/dino-grand-prix.git)
cd dino-grand-prix
```

## 🔐 Part 3: The Security Fix (IAM Permissions)
Google Cloud recently updated its security so that background builder robots don't have "Editor" permissions by default. Before we deploy, we need to grant our Cloud Build service account permission to read our files.

**Copy and paste this exact block of code into your Cloud Shell and press Enter.** *(If it asks you to authorize, click **Authorize**).*

```bash
export PROJECT_ID=$(gcloud config get-value project)
export PROJECT_NUM=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
  --role="roles/editor"
```

## 🚀 Part 4: The "Magic" Deploy
Now for the real cloud engineering. We are going to package our game, push it to Google Artifact Registry, and deploy it to a secure HTTPS server. 

Normally, this takes writing complex YAML files, but Google Cloud has a single command that handles the entire pipeline.

Run this exact command:

```bash
gcloud run deploy dino-grand-prix \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --max-instances 1 \
  --no-cpu-throttling
```

**What is this doing?**
* `--source .`: Tells Google to find our `Dockerfile`, build it, and deploy it automatically.
* `--region asia-southeast1`: Deploys the server in Singapore for the lowest ping.
* `--allow-unauthenticated`: Makes the game public on the internet.
* `--max-instances 1`: **CRITICAL.** Cloud Run usually auto-scales. We limit it to 1 instance so all players end up in the exact same multiplayer lobby!
* `--no-cpu-throttling`: Prevents the Google server from falling asleep, ensuring our game physics run at 60 FPS!

*(If the terminal asks to create an Artifact Registry repository or enable APIs, type `y` and press **Enter**).*

---

## 🎮 Part 5: Host the Grand Prix!
After 2 to 3 minutes of loading bars, the terminal will print a green **Done** message and give you your official **Service URL**. 

It will look something like: `https://dino-grand-prix-xyz123-as.a.run.app`

Your game is officially live on the internet! 

### The Setup:
* **The Big Monitor (You):** Open a new browser tab, paste your Service URL, and add `/spectator.html` to the end. Click **START RACE** when everyone is in.
* **The Players (Your Friends):** Give your Service URL to your friends, and tell them to add `/player.html` to the end.