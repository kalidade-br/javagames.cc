<div align="center">
  <img src="/j2me/logo/J2ME_icon_512x512.png" alt="J2ME Logo" width="140"/>
  <h1>J2ME Web Loader</h1>
</div>

J2ME Web Loader is designed to host, configure, and execute classic `Java ME (.jar)` mobile games and applications right inside a modern web browser. By combining a robust Node.js and Express backend with browser-side WebAssembly execution, WebGL-accelerated 3D graphics, and custom audio pipelines, it provides a safe, sandboxed sandbox environment to bring nostalgic mobile gaming to the web.


<p align="center">
  <img src="https://img.shields.io/badge/Node.js-%235FA04E.svg?style=for-the-badge&logo=nodedotjs&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind%20CSS-%2306B6D4.svg?style=for-the-badge&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-%23000000.svg?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-%233178C6.svg?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/HTML5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white" />
  <img src="https://img.shields.io/badge/CSS3-%231572B6.svg?style=for-the-badge&logo=css3&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-%232496ED.svg?style=for-the-badge&logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/XAMPP-FB7A24?style=for-the-badge&logo=XAMPP&logoColor=FFFFFF" />
</p>

---

## 💻 Tech Stack
- **Runtime**: Node.js (v20+)
- **Language**: TypeScript (v7.0+)
- **Web Framework**: Express (v4.19)
- **Frontend UI**: Vanilla HTML, CSS, and JavaScript (serving dedicated launcher and execution views)
- **Emulation & Graphics**: Browser-side Java execution runtime, WebGL 2 (for M3G and Mascot Capsule v3 3D support), and HTML5 2D Canvas rendering context
- **Audio & Media Processing**: WebAssembly-compiled FluidSynth (libmidi via WebAudio API) and FFmpeg (libmedia for media decoding)

---
## 🖼️ Screenshots
![Screenshot](/screenshot/J2ME-Games-Listing.jpg)  

---
## 🏞️ Home Page
![HomePage](/screenshot/J2ME-HomePage-index.jpg) 
---

## 📂 Project Structure

```
j2me-web-loader
├── resources
│   ├── m3d_shaders
│   └── m3g_shaders
├── j2me
│   ├── libjs
│   ├── libmedia
│   ├── libmidi
│   ├── logo
│   │   └── J2ME_icon_512x512.png
│   ├── src
│   │   ├── desktopKeyManager.js
│   │   ├── eventqueue.js
│   │   ├── gameConfigManager.js
│   │   ├── key.js
│   │   ├── launcher.js
│   │   ├── layoutManager.js
│   │   ├── main.js
│   │   └── screenKbd.js
│   ├── game_launch.zip
│   ├── index.html
│   ├── j2me-web-loader.jar
│   ├── java_icon.svg
│   └── run.html
├── .dockerignore
├── build.xml
├── bun.lock
├── docker-compose.yml
├── Dockerfile
├── index.html
├── metadata.json
├── package.json
├── README.md
└── server.ts

---

## 📜 License
This project is open-source and available under the MIT License.

### Raj Prajapati

Developed on 26th July 2026 / Sunday.
