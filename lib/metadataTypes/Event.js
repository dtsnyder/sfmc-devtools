'use strict';

import MetadataType from './MetadataType.js';
import { Util } from '../util/util.js';
import File from '../util/file.js';
import cache from '../util/cache.js';

/**
 * @typedef {import('../../types/mcdev.d.js').BuObject} BuObject
 * @typedef {import('../../types/mcdev.d.js').CodeExtract} CodeExtract
 * @typedef {import('../../types/mcdev.d.js').CodeExtractItem} CodeExtractItem
 * @typedef {import('../../types/mcdev.d.js').MetadataTypeItem} MetadataTypeItem
 * @typedef {import('../../types/mcdev.d.js').MetadataTypeItemDiff} MetadataTypeItemDiff
 * @typedef {import('../../types/mcdev.d.js').MetadataTypeItemObj} MetadataTypeItemObj
 * @typedef {import('../../types/mcdev.d.js').MetadataTypeMap} MetadataTypeMap
 * @typedef {import('../../types/mcdev.d.js').MetadataTypeMapObj} MetadataTypeMapObj
 * @typedef {import('../../types/mcdev.d.js').SoapRequestParams} SoapRequestParams
 * @typedef {import('../../types/mcdev.d.js').TemplateMap} TemplateMap
 */

/**
 * Event MetadataType
 *
 * @augments MetadataType
 */
class Event extends MetadataType {
    /**
     * Retrieves Metadata of Event Definition.
     * Endpoint /interaction/v1/eventDefinitions return all Event Definitions with all details.
     * Currently it is not needed to loop over Imports with endpoint /interaction/v1/eventDefinitions/{id}
     *
     * @param {string} retrieveDir Directory where retrieved metadata directory will be saved
     * @param {void | string[]} [_] unused parameter
     * @param {void | string[]} [__] unused parameter
     * @param {string} [key] customer key of single item to retrieve
     * @returns {Promise.<MetadataTypeMapObj>} Promise of metadata
     */
    static retrieve(retrieveDir, _, __, key) {
        Util.logBeta(this.definition.type);
        try {
            return super.retrieveREST(
                retrieveDir,
                `/interaction/v1/eventDefinitions${
                    key ? '/key:' + encodeURIComponent(key) : ''
                }?extras=all`,
                null,
                key
            );
        } catch (ex) {
            // if the event does not exist, the API returns the error "Request failed with status code 400 (ERR_BAD_REQUEST)" which would otherwise bring execution to a hold
            if (key && ex.code === 'ERR_BAD_REQUEST') {
                Util.logger.info(
                    `Downloaded: ${this.definition.type} (0)${Util.getKeysString(key)}`
                );
            } else {
                throw ex;
            }
        }
        return;
    }

    /**
     * Retrieves event definition metadata for caching
     *
     * @returns {Promise.<MetadataTypeMapObj>} Promise of metadata
     */
    static retrieveForCache() {
        return this.retrieve(null);
    }

    /**
     * Retrieve a specific Event Definition by Name
     *
     * @param {string} templateDir Directory where retrieved metadata directory will be saved
     * @param {string} name name of the metadata file
     * @param {TemplateMap} templateVariables variables to be replaced in the metadata
     * @returns {Promise.<MetadataTypeItemObj>} Promise of metadata
     */
    static async retrieveAsTemplate(templateDir, name, templateVariables) {
        Util.logBeta(this.definition.type);
        const res = await this.client.rest.get(
            '/interaction/v1/eventDefinitions?name=' + encodeURIComponent(name)
        );
        const event = res.items.filter((item) => item.name === name);
        try {
            if (!event || event.length === 0) {
                throw new Error(`No Event Definitions Found with name "${name}"`);
            } else if (event.length > 1) {
                throw new Error(
                    `Multiple Event Definitions with name "${name}"` +
                        `please rename to be unique to avoid issues`
                );
            } else if (event?.length === 1) {
                const originalKey = event[0][this.definition.keyField];
                const eventDef = JSON.parse(
                    Util.replaceByObject(
                        JSON.stringify(this.postRetrieveTasks(event[0])),
                        templateVariables
                    )
                );
                if (!eventDef.dataExtensionId) {
                    throw new Error(
                        `Event.postRetrieveTasks:: ` +
                            `No Data Extension found for ` +
                            `event: ${eventDef.name}. ` +
                            `This cannot be templated`
                    );
                }

                // remove all fields listed in Definition for templating
                this.keepTemplateFields(eventDef);
                await File.writeJSONToFile(
                    [templateDir, this.definition.type].join('/'),
                    originalKey + '.' + this.definition.type + '-meta',
                    JSON.parse(Util.replaceByObject(JSON.stringify(eventDef), templateVariables))
                );
                Util.logger.info(`- templated ${this.definition.type}: ${name}`);
                return { metadata: eventDef, type: this.definition.type };
            } else {
                throw new Error(
                    `Encountered unknown error when retrieveing ${
                        this.definition.typeName
                    } "${name}": ${JSON.stringify(res.body)}`
                );
            }
        } catch (ex) {
            Util.logger.error('Event.retrieveAsTemplate:: ' + ex);
            return null;
        }
    }

    /**
     * Delete a metadata item from the specified business unit
     *
     * @param {string} key Identifier of item
     * @returns {Promise.<boolean>} deletion success status
     */
    static deleteByKey(key) {
        Util.logBeta(this.definition.type);
        return super.deleteByKeyREST(
            '/interaction/v1/eventDefinitions/key:' + encodeURIComponent(key),
            key,
            false
        );
    }
    /**
     * Deploys metadata - merely kept here to be able to print {@link Util.logBeta} once per deploy
     *
     * @param {MetadataTypeMap} metadata metadata mapped by their keyField
     * @param {string} deployDir directory where deploy metadata are saved
     * @param {string} retrieveDir directory where metadata after deploy should be saved
     * @returns {Promise.<MetadataTypeMap>} Promise of keyField => metadata map
     */
    static async deploy(metadata, deployDir, retrieveDir) {
        Util.logBeta(this.definition.type);
        return super.deploy(metadata, deployDir, retrieveDir);
    }

    /**
     * Creates a single Event Definition
     *
     * @param {MetadataTypeItem} metadata a single Event Definition
     * @returns {Promise} Promise
     */
    static create(metadata) {
        return super.createREST(metadata, '/interaction/v1/eventDefinitions/');
    }

    /**
     * Updates a single Event Definition (using PUT method since PATCH isn't supported)
     *
     * @param {MetadataTypeItem} metadataEntry a single Event Definition
     * @returns {Promise} Promise
     */
    static async update(metadataEntry) {
        return super.updateREST(
            metadataEntry,
            '/interaction/v1/eventDefinitions/' + metadataEntry.id,
            'put'
        );
    }

    /**
     * prepares an event definition for deployment
     *
     * @param {MetadataTypeItem} metadata a single eventDefinition
     * @returns {MetadataTypeItem} parsed version
     */
    static preDeployTasks(metadata) {
        if (metadata.r__dataExtension_key) {
            metadata.dataExtensionId = cache.searchForField(
                'dataExtension',
                metadata.r__dataExtension_key,
                'CustomerKey',
                'ObjectID'
            );
            metadata.dataExtensionName = cache.searchForField(
                'dataExtension',
                metadata.r__dataExtension_key,
                'CustomerKey',
                'Name'
            );
            metadata.arguments.dataExtensionId = metadata.dataExtensionId;
            if (metadata.schema) {
                metadata.schema.id = metadata.dataExtensionId;
                metadata.schema.name = metadata.dataExtensionName;
            }
        }
        metadata.arguments.eventDefinitionKey = metadata.eventDefinitionKey;

        // standard values
        metadata.isVisibleInPicker ||= false;
        metadata.isPlatformObject = false;
        metadata.mode = 'Production'; // potentially needs to be set to "1" instead
        return metadata;
    }

    /**
     * parses retrieved Metadata before saving
     *
     * @param {MetadataTypeItem} metadata a single event definition
     * @returns {MetadataTypeItem} parsed metadata
     */
    static postRetrieveTasks(metadata) {
        try {
            metadata.r__dataExtension_key = cache.searchForField(
                'dataExtension',
                metadata.dataExtensionId,
                'ObjectID',
                'CustomerKey'
            );
            delete metadata.dataExtensionId;
            delete metadata.dataExtensionName;
            delete metadata.arguments.dataExtensionId;
            if (metadata.schema) {
                delete metadata.schema.id;
                delete metadata.schema.name;
            }
        } catch (ex) {
            Util.logger.verbose(
                ` - ${this.definition.type} ${metadata[this.definition.nameField]} (${
                    metadata[this.definition.keyField]
                }): ${ex.message}.`
            );
        }
        return metadata;
    }
}

// Assign definition to static attributes
import MetadataTypeDefinitions from '../MetadataTypeDefinitions.js';
Event.definition = MetadataTypeDefinitions.event;

export default Event;
