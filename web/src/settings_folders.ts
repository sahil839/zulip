import $ from "jquery";
import SortableJS from "sortablejs";

import render_admin_channel_folder_list_item from "../templates/settings/admin_channel_folder_list_item.hbs";

import * as channel from "./channel.ts";
import * as channel_folders from "./channel_folders.ts";
import * as channel_folders_ui from "./channel_folders_ui.ts";
import * as ListWidget from "./list_widget.ts";
import type {ChannelFolderUpdateEvent} from "./server_event_types.ts";
import * as settings_ui from "./settings_ui.ts";
import {current_user} from "./state_data.ts";
import * as util from "./util.ts";

const meta = {
    loaded: false,
};

function update_folder_order(this: HTMLElement): void {
    const order: number[] = [];
    $(".channel-folder-row").each(function () {
        order.push(Number.parseInt($(this).attr("data-channel-folder-id")!, 10));
    });
    settings_ui.do_settings_change(
        channel.patch,
        "/json/channel_folders",
        {order: JSON.stringify(order)},
        $("#admin-channel-folder-status").expectOne(),
    );
}

export function do_populate_channel_folders(): void {
    const folders_data = channel_folders.get_channel_folders();

    const $channel_folders_table = $("#admin_channel_folders_table").expectOne();

    ListWidget.create($channel_folders_table, folders_data, {
        name: "channel_folders_list",
        get_item(folder) {
            return folder;
        },
        modifier_html(folder) {
            return render_admin_channel_folder_list_item({
                folder_name: folder.name,
                folder_description: folder.description,
                id: folder.id,
                is_admin: current_user.is_admin,
            });
        },
        $parent_container: $("#channel-folder-settings").expectOne(),
        $simplebar_container: $("#channel-folder-settings .progressive-table-wrapper"),
    });

    if (current_user.is_admin) {
        const field_list = util.the($("#admin_channel_folders_table"));
        SortableJS.create(field_list, {
            onUpdate: update_folder_order,
            filter: "input",
            preventOnFilter: false,
        });
    }
}

export function populate_channel_folders(): void {
    if (!meta.loaded) {
        // If outside callers call us when we're not loaded, just
        // exit and we'll draw the widgets again during set_up().
        return;
    }
    do_populate_channel_folders();
}

export function set_up(): void {
    do_populate_channel_folders();
    meta.loaded = true;

    $("#channel-folder-settings").on(
        "click",
        ".add-channel-folder-button",
        channel_folders_ui.add_channel_folder,
    );
    $("#channel-folder-settings").on("click", ".edit-channel-folder-button", (e) => {
        const folder_id = Number.parseInt(
            $(e.target).closest(".channel-folder-row").attr("data-channel-folder-id")!,
            10,
        );
        channel_folders_ui.handle_editing_channel_folder(folder_id);
    });
    $("#channel-folder-settings").on("click", ".archive-channel-folder-button", (e) => {
        const folder_id = Number.parseInt(
            $(e.target).closest(".channel-folder-row").attr("data-channel-folder-id")!,
            10,
        );
        channel_folders_ui.handle_archiving_channel_folder(folder_id);
    });
}

export function reset(): void {
    meta.loaded = false;
}

function get_channel_folder_row(folder_id: number): JQuery {
    return $("#admin_channel_folders_table").find(
        `tr.channel-folder-row[data-channel-folder-id='${CSS.escape(folder_id.toString())}']`,
    );
}

export function update_folder_row(event: ChannelFolderUpdateEvent): void {
    if (!meta.loaded) {
        return;
    }

    const folder_id = event.channel_folder_id;
    const $folder_row = get_channel_folder_row(folder_id);

    if (event.data.name !== undefined) {
        $folder_row.find(".channel_folder_name").text(event.data.name);
    }

    if (event.data.description !== undefined) {
        $folder_row.find(".channel_folder_description").text(event.data.description);
    }

    if (event.data.is_archived) {
        $folder_row.remove();
    }
}
