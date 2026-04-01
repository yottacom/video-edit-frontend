
// components/VideoEditor.js
import { useState, useEffect, useCallback } from 'react';
import ScenesList from './ScenesList';
import { ASPECT_RATIOS } from '@/lib/config'; // Assuming path

export default function VideoEditor({ aspectRatioType }) {
  const [scenes, setScenes] = useState([
    {
      id: 'default-scene-1',
      audioAssets: [],
      primaryAssets: [],
      secondaryAssets: [],
    }
  ]);
  const [totalVideoDuration, setTotalVideoDuration] = useState(0); // Driven by audio

  const aspectRatio = ASPECT_RATIOS[aspectRatioType];

  const handleUpdateScenes = useCallback((newScenes, newDuration) => {
    setScenes(newScenes);
    if (newDuration !== undefined) {
      setTotalVideoDuration(newDuration);
    }
  }, []);

  // Effect to update totalVideoDuration if any scene's audio changes
  useEffect(() => {
    // This assumes total video duration is globally uniform, derived from the *first* scene's audio
    // Or, you might want a more complex model where each scene has its own duration
    const firstSceneAudioDuration = scenes[0]?.audioAssets[0]?.duration || 0;
    if (firstSceneAudioDuration !== totalVideoDuration) {
        setTotalVideoDuration(firstSceneAudioDuration);
        // Also need to re-calculate all primary assets based on new total duration
        setScenes(prevScenes => prevScenes.map(scene => ({
            ...scene,
            primaryAssets: calculatePrimaryAssetDurations(firstSceneAudioDuration, scene.primaryAssets)
        })));
    }
  }, [scenes, totalVideoDuration]); // Dependencies for this effect

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Create Video</h1>
      <div className="flex justify-between items-center mb-6">
        <span className="text-lg">Aspect Ratio: {aspectRatio.label}</span>
        <button className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors">
          Export Video
        </button>
      </div>

      <div className="flex flex-col lg:flex-row">
        {/* Placeholder for Video Preview */}
        <div className="w-full lg:w-1/3 p-4 bg-gray-100 rounded-lg shadow-inner mb-6 lg:mb-0 lg:mr-4 flex justify-center items-center"
             style={{ aspectRatio: `${aspectRatio.width} / ${aspectRatio.height}` }}>
          <p className="text-gray-500">Video Preview Area</p>
        </div>

        <ScenesList scenes={scenes} totalVideoDuration={totalVideoDuration} onUpdateScenes={handleUpdateScenes} />
      </div>
    </div>
  );
}
