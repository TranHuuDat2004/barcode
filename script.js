/**
 * Barcode Pro - Script Logic
 * Xử lý tạo và quét mã vạch
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    const barcodeInput = document.getElementById('barcode-input');
    const generateBtn = document.getElementById('generate-btn');
    const barcodeCanvas = document.getElementById('barcode-canvas');
    const downloadBtn = document.getElementById('download-btn');
    const placeholderText = document.querySelector('.placeholder-text');
    
    const startScanBtn = document.getElementById('start-scan-btn');
    const stopScanBtn = document.getElementById('stop-scan-btn');
    const scannerOverlay = document.getElementById('scanner-overlay');
    const scanResultCard = document.getElementById('scan-result-card');
    const scanResultValue = document.getElementById('scan-result-value');
    const copyBtn = document.getElementById('copy-btn');
    
    // Zoom controls
    const zoomControls = document.getElementById('zoom-controls');
    const zoomSlider = document.getElementById('zoom-slider');
    
    // --- State ---
    let html5QrCode = null;
    let isScanning = false;

    // --- Tab Switching Logic ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Update buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabId}-section`) {
                    content.classList.add('active');
                }
            });

            // Stop scanner if switching away from scan tab
            if (tabId !== 'scan' && isScanning) {
                stopScanner();
            }
        });
    });

    // --- Barcode Generation Logic ---
    generateBtn.addEventListener('click', () => {
        const text = barcodeInput.value.trim();
        
        if (!text) {
            showToast('Vui lòng nhập dữ liệu để tạo mã vạch');
            return;
        }

        try {
            // JsBarcode handles the SVG generation
            JsBarcode("#barcode-canvas", text, {
                format: "CODE128",
                lineColor: "#000",
                width: 2,
                height: 100,
                displayValue: true,
                fontSize: 16,
                background: "#ffffff"
            });
            
            placeholderText.classList.add('hidden');
            barcodeCanvas.classList.remove('hidden');
            downloadBtn.classList.remove('hidden');
            showToast('Đã tạo mã vạch thành công!');
        } catch (error) {
            console.error(error);
            showToast('Lỗi: Dữ liệu không hợp lệ cho định dạng CODE128');
        }
    });

    // --- Download Logic ---
    downloadBtn.addEventListener('click', () => {
        const svg = document.getElementById('barcode-canvas');
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement("canvas");
        const svgSize = svg.getBBox();
        
        // Add some padding
        canvas.width = svgSize.width + 40;
        canvas.height = svgSize.height + 40;
        
        const ctx = canvas.getContext("2d");
        const img = new Image();
        
        img.onload = () => {
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 20, 20);
            
            const pngFile = canvas.toDataURL("image/png");
            const downloadLink = document.createElement("a");
            downloadLink.download = `barcode-${barcodeInput.value}.png`;
            downloadLink.href = pngFile;
            downloadLink.click();
            showToast('Đã tải xuống mã vạch');
        };
        
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
    });

    // --- Barcode Scanning Logic ---
    const onScanSuccess = (decodedText, decodedResult) => {
        // Success callback
        console.log(`Code matched = ${decodedText}`, decodedResult);
        
        // Stop scanning after success
        stopScanner();
        
        // Show result
        scanResultValue.textContent = decodedText;
        scanResultCard.classList.remove('hidden');
        showToast('Đã tìm thấy mã vạch!');
        
        // Vibrate if supported
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }
    };

    const startScanner = async () => {
        try {
            // Reset result card
            scanResultCard.classList.add('hidden');
            
            if (!html5QrCode) {
                html5QrCode = new Html5Qrcode("reader");
            }

            const config = { 
                fps: 20, // Tăng fps để quét mượt hơn
                qrbox: (viewfinderWidth, viewfinderHeight) => {
                    // Trả về vùng quét khớp với tỉ lệ 70% width, 60% height trong CSS
                    return {
                        width: viewfinderWidth * 0.7,
                        height: viewfinderHeight * 0.6
                    };
                },
                aspectRatio: undefined // Để trình duyệt tự chọn tỉ lệ tốt nhất cho camera
            };

            // Khởi chạy camera cơ bản trước
            await html5QrCode.start(
                { facingMode: "environment" }, 
                config, 
                onScanSuccess
            );

            isScanning = true;
            startScanBtn.classList.add('hidden');
            stopScanBtn.classList.remove('hidden');
            scannerOverlay.classList.remove('hidden');
            showToast('Đang khởi động camera...');

            // Kiểm tra khả năng Zoom
            try {
                const capabilities = html5QrCode.getRunningTrackCapabilities();
                const settings = html5QrCode.getRunningTrackSettings();
                
                if (capabilities.zoom) {
                    zoomControls.classList.remove('hidden');
                    zoomSlider.min = capabilities.zoom.min;
                    zoomSlider.max = capabilities.zoom.max;
                    zoomSlider.step = capabilities.zoom.step || 0.1;
                    zoomSlider.value = settings.zoom || capabilities.zoom.min;
                    
                    zoomSlider.oninput = async () => {
                        try {
                            await html5QrCode.applyVideoConstraints({
                                advanced: [{ zoom: parseFloat(zoomSlider.value) }]
                            });
                        } catch (e) {
                            console.error("Zoom error:", e);
                        }
                    };
                }
            } catch (e) {
                console.warn("Camera không hỗ trợ các tính năng nâng cao:", e);
            }

            // Tính năng Tap to Focus (Giả lập)
            const readerElement = document.getElementById('reader');
            readerElement.onclick = async () => {
                try {
                    // Gửi lại yêu cầu focus khi người dùng chạm vào màn hình
                    await html5QrCode.applyVideoConstraints({
                        advanced: [{ focusMode: "continuous" }]
                    });
                    showToast('Đang lấy nét...');
                } catch (e) {
                    console.log("Tap to focus không được hỗ trợ");
                }
            };

        } catch (err) {
            console.error("Lỗi khởi động camera:", err);
            
            let errorMsg = 'Không thể truy cập camera.';
            if (err.name === 'NotAllowedError' || err === 'NotAllowedError') {
                errorMsg = 'Bạn đã từ chối cấp quyền camera. Vui lòng bật lại trong cài đặt trình duyệt.';
            } else if (err.name === 'NotFoundError' || err === 'NotFoundError') {
                errorMsg = 'Không tìm thấy camera trên thiết bị này.';
            } else if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
                errorMsg = 'Camera yêu cầu kết nối bảo mật (HTTPS).';
            }
            
            showToast(errorMsg);
            
            // Reset UI
            isScanning = false;
            startScanBtn.classList.remove('hidden');
            stopScanBtn.classList.add('hidden');
            scannerOverlay.classList.add('hidden');
        }
    };

    const stopScanner = async () => {
        if (html5QrCode && isScanning) {
            try {
                await html5QrCode.stop();
                isScanning = false;
                startScanBtn.classList.remove('hidden');
                stopScanBtn.classList.add('hidden');
                scannerOverlay.classList.add('hidden');
                zoomControls.classList.add('hidden');
            } catch (err) {
                console.error("Lỗi dừng camera:", err);
            }
        }
    };

    startScanBtn.addEventListener('click', startScanner);
    stopScanBtn.addEventListener('click', stopScanner);

    // --- Copy to Clipboard ---
    copyBtn.addEventListener('click', () => {
        const text = scanResultValue.textContent;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Đã sao chép vào bộ nhớ tạm');
        });
    });

    // --- Helper: Toast Notification ---
    function showToast(message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        
        container.appendChild(toast);
        
        // Remove from DOM after animation completes
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
});
