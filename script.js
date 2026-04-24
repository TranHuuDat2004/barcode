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
                fps: 10, 
                qrbox: { width: 250, height: 150 },
                aspectRatio: 1.333334
            };

            // Handling iOS Safari compatibility:
            // html5-qrcode internally handles playsinline and video initialization.
            // We ensure user interaction (click) starts the camera.
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
        } catch (err) {
            console.error("Lỗi khởi động camera:", err);
            showToast('Không thể truy cập camera. Vui lòng cấp quyền.');
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
