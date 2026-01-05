import React from 'react'
import { MAP_DATA } from './MapComponents'

export default function MapSelector({ selectedMapId, onSelect }) {
  return (
    <div className="map-selector-container">
      <div className="magic-section-title">Select Arena</div>
      <div className="map-slider">
        {MAP_DATA.map((map) => (
          <div 
            key={map.id}
            className={`map-card ${selectedMapId === map.id ? 'selected' : ''}`}
            onClick={() => onSelect(map.id)}
          >
            <div className="map-preview-placeholder">
              {/* Placeholder for image */}
              <span className="map-emoji">
                {map.emoji}
              </span>
            </div>
            <div className="map-name">{map.name}</div>
          </div>
        ))}
      </div>
      <style jsx>{`
        .map-selector-container {
          margin-top: 20px;
          width: 100%;
        }
        .map-slider {
          display: flex;
          overflow-x: auto;
          gap: 15px;
          padding: 10px 5px;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
        }
        .map-slider::-webkit-scrollbar {
          height: 6px;
        }
        .map-slider::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
        }
        .map-card {
          flex: 0 0 160px;
          height: 120px;
          background: rgba(0, 0, 0, 0.4);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .map-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.3);
          background: rgba(0, 0, 0, 0.5);
        }
        .map-card.selected {
          border-color: #ffd700;
          background: rgba(255, 215, 0, 0.1);
          box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
        }
        .map-preview-placeholder {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(45deg, rgba(255,255,255,0.05), rgba(255,255,255,0.1));
          font-size: 2rem;
        }
        .map-name {
          padding: 8px;
          text-align: center;
          font-size: 0.8rem;
          font-weight: 600;
          color: #fff;
          background: rgba(0, 0, 0, 0.3);
        }
      `}</style>
    </div>
  )
}
