/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { FormSwitch } from "@components/FormSwitch";
import { RenderModalProps } from "@vencord/discord-types";
import { FluxDispatcher, Modal, React, showToast, TextInput } from "@webpack/common";

import { Category, Media, MediaType } from "../types";
import { createCategory, editCategory } from "../utils/categoryManager";
import { getMediaData, saveMediaData } from "../utils/mediaManager";

interface CollectionModalProps extends RenderModalProps {
    type: MediaType;
    collection?: Category;
    mediaToAdd?: Media;
}

export function CollectionModal({ type, collection, mediaToAdd, onClose, transitionState }: CollectionModalProps) {
    const [name, setName] = React.useState(collection?.name ?? "");
    const [color, setColor] = React.useState(collection?.color ?? "#5865F2");
    const [censored, setCensored] = React.useState(collection?.censored ?? false);
    const [error, setError] = React.useState<string | null>(null);

    const isEditing = !!collection;

    const handleSave = React.useCallback(async () => {
        if (!name.trim()) {
            setError("Collection name is required");
            return;
        }

        if (name.length > 20) {
            setError("Collection name must be 20 characters or less");
            return;
        }

        try {
            if (isEditing) {
                const success = await editCategory(type, collection!.id, name.trim(), color, censored);
                if (!success) {
                    setError("A collection with this name already exists");
                    return;
                }
            } else {
                const success = await createCategory(type, name.trim(), color, undefined, censored);
                if (!success) {
                    setError("A collection with this name already exists");
                    return;
                }

                if (mediaToAdd) {
                    const data = await getMediaData(type);
                    const newCollection = data.categories.find(c => c.name === name.trim());
                    if (newCollection) {
                        const mediaIndex = data.medias.findIndex(m => m.url === mediaToAdd.url);
                        if (mediaIndex !== -1) {
                            data.medias[mediaIndex].category_id = newCollection.id;
                            await saveMediaData(type, data);
                        }
                    }
                }
            }

            FluxDispatcher.dispatch({ type: "FM_MEDIA_UPDATED" });
            showToast({ text: isEditing ? "Collection updated" : "Collection created", variant: "success" });
            onClose();
        } catch (err) {
            setError("Failed to save collection");
        }
    }, [name, color, censored, type, collection, mediaToAdd, isEditing, onClose]);

    return (
        <Modal size="sm" transitionState={transitionState} onClose={onClose} title={isEditing ? "Edit Collection" : "Create Collection"}>
            <div>
                <div className="fm-modal-content">
                    <div className="fm-modal-row">
                        <div className="fm-modal-input-wrapper">
                            <TextInput
                                value={name}
                                onChange={setName}
                                placeholder="Collection name"
                                maxLength={20}
                            />
                        </div>
                        <input
                            type="color"
                            className="fm-color-circle"
                            value={color}
                            onChange={e => setColor(e.target.value)}
                            title="Collection color"
                        />
                    </div>
                    <FormSwitch
                        title="Censor"
                        description="Blurs the cover of this collection."
                        value={censored}
                        onChange={setCensored}
                        hideBorder
                    />
                    {error && <div className="fm-modal-error">{error}</div>}
                </div>
            </div>
            <div className="fm-modal-footer">
                <Button onClick={handleSave}>
                    {isEditing ? "Save" : "Create"}
                </Button>
                <Button onClick={onClose} variant="link" className="fm-cancel-btn">
                    Cancel
                </Button>
            </div>
        </Modal>
    );
}
