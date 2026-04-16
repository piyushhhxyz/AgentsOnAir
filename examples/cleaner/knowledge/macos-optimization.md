# macOS Storage Optimization Guide

## Top Storage Hogs (Average Mac Developer Machine)

### 1. node_modules (5-30 GB typical)
- Average project: 200-500 MB per node_modules
- Developers with 20+ projects: 10-30 GB wasted
- Safe to delete: `find ~ -name "node_modules" -type d -maxdepth 5`
- Reclaim: Just run `npm install` when you need the project again

### 2. Docker (5-50 GB)
- Dangling images: `docker image prune` (safe)
- All unused images: `docker system prune -a` (reclaims most)
- Docker Desktop VM disk: ~/Library/Containers/com.docker.docker/Data/vms/
- Common finding: 15-30 GB in unused images

### 3. Xcode (10-40 GB)
- Derived Data: ~/Library/Developer/Xcode/DerivedData/ (safe to delete, rebuilds)
- Archives: ~/Library/Developer/Xcode/Archives/ (old builds)
- iOS Simulators: `xcrun simctl delete unavailable`
- Device Support: ~/Library/Developer/Xcode/iOS DeviceSupport/

### 4. Homebrew Cache (1-5 GB)
- Location: ~/Library/Caches/Homebrew/
- Safe to clean: `brew cleanup --prune=all`

### 5. System Caches & Logs (2-10 GB)
- User caches: ~/Library/Caches/ (generally safe)
- System logs: /var/log/ (auto-rotated but can grow)
- Spotlight index: can be rebuilt if corrupted

### 6. Downloads Folder (2-20 GB)
- DMG files after app installation
- Old zip files
- Duplicate downloads

## Performance Optimizations
- Disable Spotlight indexing for dev folders: `mdutil -i off /path`
- Reduce login items: System Preferences > Users > Login Items
- Check for runaway processes: `top -o cpu`
- Clear DNS cache: `sudo dscacheutil -flushcache`
- Reset SMC/PRAM for hardware-level issues

## Quick Wins (Usually 10-30 GB)
1. Delete old node_modules: ~5-15 GB
2. Docker prune: ~5-10 GB
3. Xcode derived data: ~3-8 GB
4. Homebrew cache: ~1-3 GB
5. Downloads cleanup: ~2-5 GB
