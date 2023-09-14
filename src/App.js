import React, { useCallback, useEffect, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import "./App.css";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

function App() {
  const [loaded, setLoaded] = useState(false);
  const ffmpegRef = useRef(new FFmpeg());
  const videoRef = useRef(null);
  const messageRef = useRef(null);
  const [thumbnails, setThumbnails] = useState([]);
  const [interval, setInterval] = useState(1);
  const filename = "output.mp4";

  const load = async () => {
    console.log("Loading ffmpeg-core");
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.2/dist/umd";
    const ffmpeg = ffmpegRef.current;
    ffmpeg.on("log", ({ message }) => {
      messageRef.current.innerHTML = message;
      console.log(message);
    });
    // toBlobURL is used to bypass CORS issue, urls with the same
    // domain can be used directly.
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
    });
    setLoaded(true);
  };

  const loadVideo = async () => {
    const ffmpeg = ffmpegRef.current;
    await ffmpeg.writeFile(
      filename,
      await fetchFile(
        "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
      )
    );
    const data = await ffmpeg.readFile(filename);
    videoRef.current.src = URL.createObjectURL(
      new Blob([data.buffer], { type: "video/mp4" })
    );
    loadThumbnails();
  };

  const loadThumbnails = useCallback(async () => {
    if (!loaded) return;
    if (!videoRef.current.src) return;
    const ffmpeg = ffmpegRef.current;
    await ffmpeg.createDir("thumbnails");
    await ffmpeg.exec([
      "-i",
      filename,
      "-vf",
      `fps=1/${interval}`,
      "thumbnails/frame%d.png",
    ]);

    const thumbnailsList = await ffmpeg.listDir("thumbnails");
    const thumbnails = [];
    for (const { name } of thumbnailsList.filter(({ name }) =>
      name.endsWith(".png")
    )) {
      const data = await ffmpeg.readFile(`thumbnails/${name}`);
      thumbnails.push({
        name,
        blob: URL.createObjectURL(
          new Blob([data.buffer], { type: "image/png" })
        ),
      });
      await ffmpeg.deleteFile(`thumbnails/${name}`);
    }

    setThumbnails(thumbnails);
    await ffmpeg.deleteDir("thumbnails");
  }, [interval, loaded]);

  const handleIntervalChange = (e) => {
    setInterval(parseInt(e.target.value));
  };

  useEffect(() => {
    loadThumbnails();
  }, [loadThumbnails]);

  return loaded ? (
    <div className="container">
      <video ref={videoRef} controls></video>
      <br />
      <button onClick={loadVideo}>Load Video</button>
      <br />
      <label htmlFor="thumbnail_interval">Thumbnail Interval</label>
      <select
        name="thumbnail_interval"
        value={interval}
        onChange={handleIntervalChange}
      >
        <option value={1}>1s</option>
        <option value={3}>3s</option>
        <option value={5}>5s</option>
        <option value={10}>10s</option>
        <option value={20}>20s</option>
      </select>
      <p ref={messageRef}></p>

      <div>
        <h2>Thumbnails</h2>
        <div className="thumbnails">
          {thumbnails.map(({ name, blob }) => (
            <img key={name} src={blob} alt={name} />
          ))}
        </div>
      </div>
    </div>
  ) : (
    <>
      <button onClick={load}>Load ffmpeg-core (~31 MB)</button>
    </>
  );
}

export default App;
