import Uppy from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import ImageEditor from "@uppy/image-editor";

import {$t} from "./i18n.ts";
import * as settings_data from "./settings_data.ts";
import * as util from "./util.ts";

export type UploadWidget = {
    clear: () => void;
    close: () => void;
};

export type UploadFunction = (
    $file_input: JQuery<HTMLInputElement>,
    night: boolean | null,
    icon: boolean,
) => void;

const default_max_file_size = 5;

const uppy_widget_map = new Map<string, Upyy | null>([
    ["realm_logo", null],
    ["realm_icon", null],
]);

// These formats do not need to be universally understood by clients; they are all
// converted, server-side, currently to PNGs.  This list should be kept in sync with
// the THUMBNAIL_ACCEPT_IMAGE_TYPES in zerver/lib/thumbnail.py
const supported_types = [
    "image/avif",
    "image/gif",
    "image/heic",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/webp",
];

function is_image_format(file: File): boolean {
    const type = file.type;
    if (!type) {
        return false;
    }
    return supported_types.includes(type);
}

export function build_widget(
    // function returns a jQuery file input object
    get_file_input: () => JQuery<HTMLInputElement>,
    // jQuery object to show file name
    $file_name_field: JQuery,
    // jQuery object for error text
    $input_error: JQuery,
    // jQuery button to clear last upload choice
    $clear_button: JQuery,
    // jQuery button to open file dialog
    $upload_button: JQuery,
    $preview_text?: JQuery,
    $preview_image?: JQuery,
    max_file_upload_size = default_max_file_size,
): UploadWidget {
    function accept(file: File): void {
        $file_name_field.text(file.name);
        $input_error.hide();
        $clear_button.show();
        $upload_button.hide();
        if ($preview_text !== undefined && $preview_image !== undefined) {
            const image_blob = URL.createObjectURL(file);
            $preview_image.attr("src", image_blob);
            $preview_image.addClass("upload_widget_image_preview");
            $preview_text.show();
        }
    }

    function clear(): void {
        const $control = get_file_input();
        $control.val("");
        $file_name_field.text("");
        $clear_button.hide();
        $upload_button.show();
        if ($preview_text !== undefined) {
            $preview_text.hide();
        }
    }

    $clear_button.on("click", (e) => {
        clear();
        e.preventDefault();
    });

    $upload_button.on("drop", (e) => {
        const files = e.originalEvent?.dataTransfer?.files;
        if (files === null || files === undefined || files.length === 0) {
            return false;
        }
        util.the(get_file_input()).files = files;
        e.preventDefault();
        return false;
    });

    get_file_input().attr("accept", supported_types.toString());
    get_file_input().on("change", (e) => {
        if (e.target.files?.[0] === undefined) {
            $input_error.hide();
        } else if (e.target.files.length === 1) {
            const file = e.target.files[0];
            if (file.size > max_file_upload_size * 1024 * 1024) {
                $input_error.text(
                    $t(
                        {defaultMessage: "File size must be at most {max_file_size} MiB."},
                        {max_file_size: max_file_upload_size},
                    ),
                );
                $input_error.show();
                clear();
            } else if (!is_image_format(file)) {
                $input_error.text($t({defaultMessage: "File type is not supported."}));
                $input_error.show();
                clear();
            } else {
                accept(file);
            }
        } else {
            $input_error.text($t({defaultMessage: "Please just upload one file."}));
        }
    });

    $upload_button.on("click", (e) => {
        get_file_input().trigger("click");
        e.preventDefault();
    });

    function close(): void {
        clear();
        $clear_button.off("click");
        $upload_button.off("drop");
        get_file_input().off("change");
        $upload_button.off("click");
    }

    return {
        // Call back to clear() in situations like adding bots, when
        // we want to use the same widget over and over again.
        clear,
        // Call back to close() when you are truly done with the widget,
        // so you can release handlers.
        close,
    };
}

export function build_direct_upload_widget(
    // function returns a jQuery file input object
    get_file_input: () => JQuery<HTMLInputElement>,
    // jQuery object for error text
    $input_error: JQuery,
    // jQuery button to open file dialog
    $upload_button: JQuery,
    upload_function: UploadFunction,
    max_file_upload_size: number,
    property_name: string,
): void {
    // default value of max uploaded file size
    function accept(): void {
        $input_error.hide();
        const $realm_logo_section = $upload_button.closest(".image_upload_widget");
        if (property_name === "user_avatar") {
            upload_function(get_file_input(), null, true);
            return;
        }

        const $file_input = get_file_input();
        const files = util.the($file_input).files;
        const uppy = uppy_widget_map.get(property_name);
        uppy.on("file-editor:start", (file) => {
            console.log("Open modal")
            uppy.getPlugin("Dashboard").openModal();
        });

        const file_id = uppy.addFile({
            name: "my-file.jpg",
            type: "image/jpeg",
            data: files[0],
            source: "Local",
            isRemote: false,
        });

        // setTimeout(() => {
        //     uppy.getPlugin("Dashboard").openModal();
        // }, 0);

        uppy.on("file-editor:cancel", (file) => {
        //     uppy.removeFile(file.id);
        //     $file_input.val("");
            setTimeout(() => {
                uppy.getPlugin("Dashboard").closeModal();
            }, 500);
        });
        uppy.on("dashboard:modal-closed", (file) => {
            uppy.cancelAll();
            $file_input.val("");
        });
        uppy.on("file-editor:complete", (file) => {
            const updated_image_blob = file.data;
            const updated_image_file = new File([updated_image_blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
            });
            if (property_name === "realm_icon") {
                upload_function(updated_image_file, null, true);
            } else {
                const is_night =
                    $realm_logo_section.attr("id") === "realm-night-logo-upload-widget";
                upload_function(updated_image_file, is_night, false);
            }
            uppy.removeFile(file.id);
            $file_input.val("");
            uppy.getPlugin("Dashboard").closeModal();
        });
    }

    function clear(): void {
        const $control = get_file_input();
        $control.val("");
    }

    $upload_button.on("drop", (e) => {
        const files = e.originalEvent?.dataTransfer?.files;
        if (files === null || files === undefined || files.length === 0) {
            return false;
        }
        util.the(get_file_input()).files = files;
        e.preventDefault();
        return false;
    });

    get_file_input().attr("accept", supported_types.toString());
    get_file_input().on("change", (e) => {
        if (e.target.files?.[0] === undefined) {
            $input_error.hide();
        } else if (e.target.files.length === 1) {
            const file = e.target.files[0];
            if (file.size > max_file_upload_size * 1024 * 1024) {
                $input_error.text(
                    $t(
                        {defaultMessage: "File size must be at most {max_file_size} MiB."},
                        {max_file_size: max_file_upload_size},
                    ),
                );
                $input_error.show();
                clear();
            } else if (!is_image_format(file)) {
                $input_error.text($t({defaultMessage: "File type is not supported."}));
                $input_error.show();
                clear();
            } else {
                accept();
            }
        } else {
            $input_error.text($t({defaultMessage: "Please just upload one file."}));
        }
    });

    $upload_button.on("click", (e) => {
        get_file_input().trigger("click");
        e.preventDefault();
    });
}

export function set_up_uppy_editing(
    property_name: string,
    cropperOptions: {aspectRatio: number},
): void {
    const uppy = new Uppy({
        restrictions: {
            allowedFileTypes: supported_types,
            maxNumberOfFiles: 1,
        },
    })
        .use(Dashboard, {
            target: "#uppy-editor",
            theme: settings_data.using_dark_theme() ? "dark" : "light",
            autoOpen: "imageEditor",
            hideUploadButton: true,
            animateOpenClose: true,
            closeModalOnClickOutside: true,
        })
        .use(ImageEditor, {
            id: "ImageEditor",
            quality: 1,
            actions: {
                cropSquare: false,
                cropWidescreen: false,
                cropWidescreenVertical: false,
                zoomIn: true,
                zoomOut: true,
                revert: false,
                rotate: false,
                granularRotate: false,
                flip: false,
            },
            cropperOptions: {
                viewMode: 1,
                aspectRatio: cropperOptions.aspectRatio,
                background: true,
                cropBoxResizable: true,
                movable: true,
                restore: true,
                responsive: false,
                zoomOnWheel: false,
                croppedCanvasOptions: {},
                dragMode: "none",
            },
            locale: {
                strings: {
                    aspectRatioSquare: "Reset",
                },
                pluralize: (n) => (n === 1 ? 0 : 1),
            },
        });
    uppy_widget_map.set(property_name, uppy);
}
