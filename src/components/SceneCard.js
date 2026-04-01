
// components/SceneCard.js
import { useState, useEffect } from 'react';
import AssetTimeline from './AssetTimeline';

export default function SceneCard({ scene, sceneIndex, totalVideoDuration, onUpdateScene, onRemoveScene }) {
  // Internal state for assets, syncs with parent via onUpdateScene
  const [sceneAssets, setSceneAssets] = useState(scene);

  useEffect(() => {
    setSceneAssets(scene);
  }, [scene]);

  const updateAssets = (type, newAssets) => {
    const updatedScene = { ...sceneAssets, [type]: newAssets };
    setSceneAssets(updatedScene);
    onUpdateScene(sceneIndex, updatedScene);
  };

  return (
    <div className="border p-4 mb-6 rounded-lg shadow-md bg-white">
      <h2 className="text-xl font-bold mb-4 flex justify-between items-center">
        Scene {sceneIndex + 1}
        <button onClick={() => onRemoveScene(sceneIndex)} className="text-red-500 hover:text-red-700">Remove</button>
      </h2>
      <AssetTimeline
        type="audio"
        assets={sceneAssets.audioAssets}
        totalVideoDuration={totalVideoDuration}
        onUpdateAssets={(newAssets) => updateAssets('audioAssets', newAssets)}
      />
      <AssetTimeline
        type="primary"
        assets={sceneAssets.primaryAssets}
        totalVideoDuration={totalVideoDuration}
        onUpdateAssets={(newAssets) => updateAssets('primaryAssets', newAssets)}
      />
      <AssetTimeline
        type="secondary"
        assets={sceneAssets.secondaryAssets}
        totalVideoDuration={totalVideoDuration}
        onUpdateAssets={(newAssets) => updateAssets('secondaryAssets', newAssets)}
      />
    </div>
  );
}

