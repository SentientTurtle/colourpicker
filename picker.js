/**
 * Linearizes colour component
 * @param colourValue Colour component, in range 0 <= colourValue <= 1
 * @returns {number} Linearized colour component (range 0 to 1)
 */
function linearize(colourValue) {
    if (typeof colourValue !== 'number' || colourValue < 0 || colourValue > 1) {
        throw new Error("colourValue must be number in range of 0 <= colourValue <= 1")
    }
    if (colourValue <= 0.03928) {
        return colourValue / 12.92;
    } else {
        return Math.pow((colourValue + 0.055) / 1.055, 2.4)
    }
}

/**
 * Calculates luminance for a given colour
 * @param {number} red Colour red component, in range 0 <= red <= 1
 * @param {number} green Colour green component, in range 0 <= green <= 1
 * @param {number} blue Colour blue component, in range 0 <= blue <= 1
 * @returns {number} Luminance value
 */
function calcLuminance(red, green, blue) {
    if (typeof red !== 'number' || red < 0 || red > 1) {
        throw new Error("red must be number in range of 0 <= red <= 1")
    }
    if (typeof green !== 'number' || green < 0 || green > 1) {
        throw new Error("green must be number in range of 0 <= green <= 1")
    }
    if (typeof blue !== 'number' || blue < 0 || blue > 1) {
        throw new Error("blue must be number in range of 0 <= blue <= 1")
    }

    return 0.2126 * linearize(red)
        + 0.7152 * linearize(green)
        + 0.0722 * linearize(blue)
}

/**
 * Interpolates the range of tints between pure white and the specified hue
 * For hues, one component must always be 1, another in the range of 0 <= N <= 1, and the last 0
 * Interpolation is done linearly through RGB space
 *
 * @param {number} red Hue red component, in range 0 <= red <= 1
 * @param {number} green Hue green component, in range 0 <= green <= 1
 * @param {number} blue Hue blue component, in range 0 <= blue <= 1
 * @returns {[number, number, number][]} Array of tints; Each value is an array of [red, green, blue] in range 0 <= N <= 1
 */
function interpolateTints(red, green, blue) {
    if (typeof red !== 'number' || red < 0 || red > 1) {
        throw new Error("red must be number in range of 0 <= red <= 1")
    }
    if (typeof green !== 'number' || green < 0 || green > 1) {
        throw new Error("green must be number in range of 0 <= green <= 1")
    }
    if (typeof blue !== 'number' || blue < 0 || blue > 1) {
        throw new Error("blue must be number in range of 0 <= blue <= 1")
    }
    if ((red !== 0 && green !== 0 && blue !== 0) || (red === 1 && green === 1 && blue === 1) || (red !== 1 && green !== 1 && blue !== 1)) {
        throw Error("Specified colour must be a pure hue; one component must always be 1, another in the range of 0 <= N <= 1, and the last 0")
    }

    // Colours are in range 0-1, but we interpolate 255 steps
    const delta_red = (1 - red) / 255;
    const delta_green = (1 - green) / 255;
    const delta_blue = (1 - blue) / 255;

    let tint_array = [];
    for (let i = 0; i < 256; i++) {
        tint_array.push([
            Math.max(red, 1 - (delta_red * i)),
            Math.max(green, 1 - (delta_green * i)),
            Math.max(blue, 1 - (delta_blue * i))
        ]);
    }

    return tint_array;
}

/**
 * Calculates a one-component "grayscale" shade multiplier for a colour with the specified luminance and tint
 * For tints, at least one colour component must be equal to 1
 *
 * @param targetLuminance Desired luminance of tint multiplied by shade, in range 0 <= targetLuminance <= 1
 * @param {number} red Tint red component, in range 0 <= red <= 1
 * @param {number} green Tint green component, in range 0 <= green <= 1
 * @param {number} blue Tint blue component, in range 0 <= blue <= 1
 * @returns {number} Shade multiplier, in range 0 <= shade <= INF; Values greater than 1 indicate the desired luminance cannot be achieved with the specified tint
 */
function shadeToLuminance(targetLuminance, red, green, blue) {
    if (typeof targetLuminance !== 'number' || targetLuminance < 0 || targetLuminance > 1) {
        throw new Error("targetLuminance must be number in range of 0 <= targetLuminance <= 1")
    }
    if (typeof red !== 'number' || red < 0 || red > 1) {
        throw new Error("red must be number in range of 0 <= red <= 1")
    }
    if (typeof green !== 'number' || green < 0 || green > 1) {
        throw new Error("green must be number in range of 0 <= green <= 1")
    }
    if (typeof blue !== 'number' || blue < 0 || blue > 1) {
        throw new Error("blue must be number in range of 0 <= blue <= 1")
    }
    if (red !== 1 && green !== 1 && blue !== 1) {
        throw Error("Specified colour must be a pure tint; one colour component must be 1")
    }

    const tintLuminance = calcLuminance(red, green, blue);

    // Scale target luminance by inverse of tint luminance to account for luminance loss in tint * gray shade multiplication later
    // As at least one colour component is 1 (non-zero), the following division will not divide-by-zero.
    const scaledLuminance = targetLuminance / tintLuminance;

    let shade;
    if (scaledLuminance < (0.03928 / 12.92)) {
        shade = scaledLuminance * 12.92;
    } else {
        shade = Math.pow(scaledLuminance, 1 / 2.4) * 1.055 - 0.055
    }

    return shade;
}

document.addEventListener("DOMContentLoaded", function (event) {
    /// Hue and colours stored in range 0 <= colour <= 1
    let current_hue = [0, 1, 1];
    let current_tints = interpolateTints(...current_hue);
    let current_colour = [1, 1, 1];
    let current_luminance = 1;

    let line_mode = "NONE";

    const picker = document.querySelector('#colour-picker');

    const hue_slider = document.querySelector('#hue-slider');
    const hue_input = document.querySelector('#hue-input');
    function recalculateHue() {
        const hue = parseFloat(hue_slider.value);


        picker.style.setProperty("--selected-hue", "hsl(" + hue + ", 100%, 50%)");

        let hue_rgb_array = getComputedStyle(saturation_element).backgroundColor.match(/rgb\((\d+), (\d+), (\d+)\)/);
        current_hue = [parseInt(hue_rgb_array[1]) / 255, parseInt(hue_rgb_array[2]) / 255, parseInt(hue_rgb_array[3]) / 255];
        current_tints = interpolateTints(...current_hue);

        recalculateColour();
        renderChart();
        renderLines();
    }

    hue_slider.addEventListener('input', recalculateHue);
    hue_input.addEventListener('input', recalculateHue);
    hue_slider.addEventListener("input", (e) => hue_input.value = e.currentTarget.value)
    hue_input.addEventListener("input", (e) => hue_slider.value = e.currentTarget.value)
    hue_input.value = hue_slider.value;

    const saturation_element = document.querySelector('#saturation');
    const colour_position = document.querySelector("#saturation-position");
    let position_left = 1;
    let position_bottom = 0;
    function moveIndicator(e) {
        const rect = saturation_element.getBoundingClientRect();
        position_left = Math.max(Math.min((e.clientX - rect.left) / (rect.right - rect.left), 1), 0);
        position_bottom = Math.max(Math.min((e.clientY - rect.top) / (rect.bottom - rect.top), 1), 0);

        colour_position.style.left = (position_left * 100) + "%";
        colour_position.style.top = (position_bottom * 100) + "%";

        recalculateColour();
    }

    saturation_element.onmousedown = (e) => {
        e.preventDefault();
        moveIndicator(e);
        document.onmousemove = moveIndicator;
        document.onmouseup = (e) => {
            document.onmousemove = null;
            colour_indicator.style.width = "1em";
            colour_indicator.style.height = "1em";
            document.body.classList.remove("cursor-pointer");
        };
        colour_indicator.style.width = "2em";
        colour_indicator.style.height = "2em";
        document.body.classList.add("cursor-pointer");
    };

    const colour_indicator = document.querySelector("#saturation-indicator");
    const preview_hex = document.querySelector("#preview-hex");
    const preview_rgb = document.querySelector("#preview-rgb");
    const preview_luminance = document.querySelector("#preview-luminance");
    function recalculateColour() {
        const [hue_red, hue_green, hue_blue] = current_hue;

        // Colours are linearly interpolated through RGB; This produces acceptable results as we only interpolate towards pure white and pure black
        const [tint_red, tint_green, tint_blue] = [
            1 + (hue_red - 1) * position_left,
            1 + (hue_green - 1) * position_left,
            1 + (hue_blue - 1) * position_left,
        ];

        const colour = [
            tint_red * (1 - position_bottom),
            tint_green * (1 - position_bottom),
            tint_blue * (1 - position_bottom)
        ];

        // Clamp colours to 8-bit; This ensures luminance calculations match the colour hex and RGB codes.
        const [red, green, blue] = colour.map((component) => Math.round(component * 255) / 255);

        picker.style.setProperty("--selected-colour", "rgb(" + red * 255 + ", " + green * 255 + ", " + blue * 255 + ")");

        current_colour = [red, green, blue];
        current_luminance = calcLuminance(red, green, blue);

        preview_hex.value = "#"
            + (red * 255).toString(16).toUpperCase().padStart(2, '0')
            + (green * 255).toString(16).toUpperCase().padStart(2, '0')
            + (blue * 255).toString(16).toUpperCase().padStart(2, '0');

        preview_rgb.value = (red * 255).toString(10) + ", "
            + (green * 255).toString(10) + ", "
            + (blue * 255).toString(10);

        preview_luminance.value = current_luminance.toFixed(5)

        if (current_luminance < 0.1792) {
            colour_indicator.style.borderColor = 'white';
        } else {
            colour_indicator.style.borderColor = 'black';
        }
    }

    const chart_canvas = document.querySelector("#saturation-chart");
    // Rendering the chart "manually" rather than using CSS gradients ensures we consistently interpolate colours in the same way
    function renderChart() {
        const context = chart_canvas.getContext('2d', {alpha: false});
        const width = chart_canvas.width;
        const height = chart_canvas.height;

        context.clearRect(0, 0, width, height);
        const imageData = context.createImageData(256, 256);

        const deltas = current_tints.map(([r, g, b]) => [r / 255, g / 255, b / 255])

        for (let i = 0; i < 256; i++) {
            for (let j = 0; j < 256; j++) {
                const idx = (i * 256 + j) * 4;
                const [r, g, b] = [
                    current_tints[j][0] - (deltas[j][0] * i),
                    current_tints[j][1] - (deltas[j][1] * i),
                    current_tints[j][2] - (deltas[j][2] * i)
                ];

                imageData.data[idx] = r * 255;
                imageData.data[idx + 1] = g * 255;
                imageData.data[idx + 2] = b * 255;
                imageData.data[idx + 3] = 255;  // No alpha
            }
        }

        context.putImageData(imageData, 0, 0);
    }


    let contrast_ratio = 4.5;
    let contrast_upper_luminance = 1;
    let contrast_lower_luminance = 0;

    const contrast_colour_input = document.querySelector("#contrast-colour-input");
    const contrast_ratio_input = document.querySelector("#contrast-ratio-input");
    const contrast_minimum_luminance = document.querySelector("#preview-contrast-minimum-luminance");
    const contrast_maximum_luminance = document.querySelector("#preview-contrast-maximum-luminance");

    function recalculateContrast() {
        let r = Math.max(0, Math.min(255, parseInt(contrast_colour_input.value.slice(1,3), 16)));
        let g = Math.max(0, Math.min(255, parseInt(contrast_colour_input.value.slice(3,5), 16)));
        let b = Math.max(0, Math.min(255, parseInt(contrast_colour_input.value.slice(5,7), 16)));
        if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) { return; }

        const colour_luminance = calcLuminance(r/255, g/255,b/255);

        contrast_upper_luminance = 0.05 * (20 * colour_luminance * contrast_ratio + contrast_ratio - 1);
        contrast_lower_luminance = (colour_luminance - 0.05 * contrast_ratio + 0.05) / contrast_ratio;

        if (contrast_upper_luminance >= 0 && contrast_upper_luminance <= 1) {
            contrast_minimum_luminance.value = contrast_upper_luminance.toFixed(5);
        } else {
            contrast_minimum_luminance.value = "N/A (" + contrast_upper_luminance.toFixed(3) + ")";
        }
        if (contrast_lower_luminance >= 0 && contrast_lower_luminance <= 1) {
            contrast_maximum_luminance.value = contrast_lower_luminance.toFixed(5);
        } else {
            contrast_maximum_luminance.value = "N/A (" + contrast_lower_luminance.toFixed(3) + ")";
        }

        renderLines();
    }

    contrast_ratio_input.addEventListener("input", (e) => {
        const value = parseFloat(e.currentTarget.value);
        if (!Number.isNaN(value)) {
            contrast_ratio = Math.max(1, Math.min(21, value));
            e.currentTarget.value = contrast_ratio;
            recalculateContrast();
        }
    })
    contrast_colour_input.addEventListener("input", recalculateContrast);

    const line_canvas = document.querySelector("#saturation-lines");
    function renderLines() {
        const context = line_canvas.getContext('2d', {alpha: true});
        const width = line_canvas.width;
        const height = line_canvas.height;

        context.clearRect(0, 0, width, height);
        context.lineWidth = 2;
        context.strokeStyle = 'black';

        switch (line_mode) {
            case "NONE":
                break;
            case "B/W": {
                // We cheat the luminance here; There is a slight overlap between the minimum luminance for black text (0.1751) and maximum for white text (0.183333)
                // Drawing a single line is clearer, so we draw it at the middle of those two values (+ a little to account for the shadow)

                // Set a shadow to draw a line that is black with a second white line below it.
                context.shadowColor = 'white';
                context.shadowBlur = 1;
                context.shadowOffsetY = 2;

                context.beginPath();

                // Initialise position
                const shade = shadeToLuminance(0.1795, ...current_tints[1]);
                context.moveTo(0, (1 - shade) * height);
                // Draw line segments
                for (let i = 0; i < current_tints.length; i++) {
                    const shade = shadeToLuminance(0.1795, ...current_tints[i]);
                    context.lineTo(i / (current_tints.length - 1) * width, (1 - shade) * height);
                }
                context.stroke();

                context.shadowColor = null;
                context.shadowBlur = null;
                context.shadowOffsetY = null;
                break;
            }
            case "COLOUR": {
                // Filling with black is clunky
                context.fillStyle = "black";
                context.beginPath();

                if (contrast_upper_luminance <= 0 || contrast_lower_luminance >= 1) {
                    // Do nothing; Entire paint area is out of bounds as upper luminance is always greater than lower luminance
                    break;
                } else if (contrast_upper_luminance >= 1) {
                    context.moveTo(0, 0);
                    context.lineTo(width, 0);
                } else {
                    // Upper bound between 0 and 1

                    const shade = shadeToLuminance(contrast_upper_luminance, ...current_tints[1]);
                    context.moveTo(0, (1 - shade) * height);

                    for (let i = 0; i < current_tints.length; i++) {
                        const shade = shadeToLuminance(contrast_upper_luminance, ...current_tints[i]);
                        context.lineTo(i / (current_tints.length - 1) * width, (1 - shade) * height);
                    }
                }

                if (contrast_lower_luminance <= 0) {
                    context.lineTo(width, height);
                    context.lineTo(0, height);
                } else {
                    // lower bound between 0 and 1
                    for (let i = current_tints.length - 1; i >= 0; i--) {
                        const shade = shadeToLuminance(contrast_lower_luminance, ...current_tints[i]);
                        context.lineTo(i / (current_tints.length - 1) * width, (1 - shade) * height);
                    }
                }
                context.closePath();
                context.fill();

                break;
            }
        }
    }

    document.querySelectorAll(".line-radio").forEach((radio) => radio.addEventListener("change", (e) => {
        line_mode = e.currentTarget.value;
        renderLines();
    }));

    recalculateHue();
    recalculateColour();
    recalculateContrast();
    renderChart();
    renderLines();
})

