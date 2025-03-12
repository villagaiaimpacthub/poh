# Proof of Humanity Network Visualization

An interactive visualization of the Proof of Humanity network growth and DID distribution system.

## Features

- Dynamic network visualization using D3.js
- Node progression based on DID accumulation:
  - Green: New users (0 DIDs)
  - Blue: Parents (2 DIDs)
  - Purple: Grandparents (3 DIDs)
  - Gold: Full Node Access (6 DIDs)
- Real-time network statistics
- Interactive node information
- Network growth simulation with undo capability

## Setup

1. Clone the repository:
```bash
git clone https://github.com/villagaiaimpacthub/poh.git
```

2. Open `index.html` in a web browser

## Controls

- **Grow Network**: Advance the network simulation one step
- **Back**: Undo the last network change
- **Reset**: Reset the network to initial state
- **Center**: Center the network view
- **Zoom Controls**: Zoom in/out and reset zoom
- **Auto Verification**: Toggle automatic network growth
- **Verification Period**: Adjust the time between automatic growth steps

## Network Rules

1. New users start as green nodes (0 DIDs)
2. Users become blue parents when verified (2 DIDs)
3. Parents become purple grandparents at 3 DIDs
4. Grandparents achieve full node access (gold) at 6 DIDs

## Dependencies

- D3.js v7.x 