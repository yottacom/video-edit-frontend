
// components/ScenesList.js
import { useState, useEffect } from 'react';
import SceneCard from './SceneCard';
import { calculatePrimaryAssetDurations } from '@/lib/utils';

export default function ScenesList({ scenes, totalVideoDuration, onUpdateScenes }) {
  const handleAddScene = () => {
    const newScene = {
      id: `scene-${Date.now()}`,
      audioAssets: [],
      primaryAssets: [],
      secondaryAssets: [],
    };
    onUpdateScenes([...scenes, newScene]);
  };

  const handleUpdateScene = (index, updatedScene) => {
    const newScenes = scenes.map((s, i) => (i === index ? updatedScene : s));

    // Handle audio change effect on total video duration
    const newTotalVideoDuration = updatedScene.audioAssets[0]?.duration || 0;
    if (newTotalVideoDuration !== totalVideoDuration) {
        // Recalculate primary assets across all scenes if total duration changed
        const updatedScenesWithResizedPrimary = newScenes.map(s => ({
            ...s,
            primaryAssets: calculatePrimaryAssetDurations(newTotalVideoDuration, s.primaryAssets)
        }));
        onUpdateScenes(updatedScenesWithResizedPrimary, newTotalVideoDuration);
    } else {
        onUpdateScenes(newScenes, totalVideoDuration);
    }
  };

  const handleRemoveScene = (index) => {
    const newScenes = scenes.filter((_, i) => i !== index);
    onUpdateScenes(newScenes, totalVideoDuration); // Pass current total duration
  };


  return (
    <div className="w-full lg:w-2/3 p-4">
      {scenes.map((scene, index) => (
        <SceneCard
          key={scene.id}
          scene={scene}
          sceneIndex={index}
          totalVideoDuration={totalVideoDuration}
          onUpdateScene={handleUpdateScene}
          onRemoveScene={handleRemoveScene}
        />
      ))}
      <button
        onClick={handleAddScene}
        className="mt-4 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
      >
        + Add Scene
      </button>
    </div>
  );
}