const bedrock = require('bedrock-protocol')
const server = bedrock.createServer({
    host: '0.0.0.0',   
    port: 19132,       
    offline: true,    
    motd: {
        motd: 'Funtime Server',
        levelName: 'Wonderland'
    }
})

server.on('connect', (client) => {
    client.on('join', () => {
        // Welcome message
        // client.queue('text', {
        //     type: 'system',
        //     needs_translation: false,
        //     source_name: '',
        //     xuid: '',
        //     platform_chat_id: '',
        //     message: `${client.profile.name} just joined the server!`
        // })

        // Start game
        client.queue('start_game', {
            entity_id: 1,
            runtime_entity_id: 1,
            player_gamemode: 1,
            player_position: [0, 5, 0],
            rotation: [0, 0],
            seed: 0,
            dimension: 0,
            generator: 1,
            world_gamemode: 1,
            difficulty: 1,
            spawn_position: [0, 5, 0],
            achievements_disabled: true,
            editor_world: false,
            created_in_editor: false,
            exported_from_editor: false,
            day_cycle_stop_time: 1,
            edu_offer: 0,
            edu_features_enabled: false,
            edu_product_uuid: '',
            rain_level: 0,
            lightning_level: 0,
            platform_broadcast_mode: 0,
            platform_broadcast_intent: 0,
            has_locked_behavior_pack: false,
            has_locked_resource_pack: false,
            is_from_locked_world_template: false,
            use_msa_gamertags_only: false,
            is_from_world_template: false,
            is_world_template_option_locked: false,
            only_spawn_v1_villagers: false,
            persona_disabled: false,
            custom_skins_disabled: false,
            emote_chat_muted: false,
            game_version: '*',
            limited_world_width: 16,
            limited_world_length: 16,
            is_new_nether: false,
            edu_resource_uri: {
                button_name: '',
                link_uri: ''
            },
            experimental_gameplay_override: false,
            chat_restriction_level: 'none',
            disable_player_interactions: false,
            level_id: '',
            world_name: 'Test World',
            premium_world_template_id: '',
            is_trial: false,
            movement_authority: 'server',
            rewind_history_size: 0,
            server_authoritative_block_breaking: false,
            current_tick: [0, 0],
            enchantment_seed: 0,
            block_properties: [],
            itemstates: [],
            multiplayer_correlation_id: '',
            server_authoritative_inventory: false,
            engine: 'vanilla',
            property_data: {},
            block_pallette_checksum: [0, 0],
            world_template_id: '',
            client_side_generation: false
        })

        // Log skin data when received
        client.on('player_skin', (packet) => {
            console.log('Received skin data:', JSON.stringify(packet, null, 2))
        })
    })
})
